// САЙТ ИЗ БАЗЫ, этапы 2–3 (05.11.2026): живые данные для страниц, которые
// рисует сервер. Раз в FRESH_MS забираем из базы ВСЕХ опубликованных
// подрядчиков — и наших (конвейер specialist-page пишет их в базу), и из
// кабинета, с правками владельцев «ведём мы» — и подставляем в общие таблицы
// data/specialists.ts (applyLive). База — единственный источник. Каталоги, визитки, «Похожие», счётчики
// читают эти таблицы и видят свежее без пересборки сайта.
//
// Путь карточки тот же, что у сборки и превью: page (собрал хук при одобрении)
// → cardFromPage (lib/cabinet-card.mjs). Фото — оригиналы из базы по публичному
// адресу /api/files/…, их режет /_image (разрешено в astro.config).
// Только опубликованное: фильтр status = "published" — здесь, на сервере.
// База не ответила — остаётся последнее удачное состояние, страница не падает.
import type { ImageMetadata } from 'astro';
import { inferRemoteSize } from 'astro:assets';
import { cardFromPage, orderedPhotos } from './cabinet-card.mjs';
import { registerRemote, hasRemote, hasLocalImage } from './images';
import { applyLive, type OwnerEdits, type Specialist } from '../data/specialists';

const PB = (process.env.PB_INTERNAL_URL || 'http://127.0.0.1:8090').replace(/\/$/, '');
const FILES = (process.env.PREVIEW_FILES_URL || 'https://wed-secrets.ru').replace(/\/$/, '');
const FRESH_MS = 20_000;

let freshAt = 0;
let inflight: Promise<void> | null = null;

interface PbRecord {
  id: string;
  collectionId: string;
  slug: string;
  categorySlug: string;
  name: string;
  photos?: string[];
  page?: Record<string, any>;
  /** имя файла в базе → исходный путь в src/assets (пишет pb-seed-specialists) */
  photoIndex?: Record<string, string>;
}

async function fetchPublished(): Promise<PbRecord[]> {
  const filter = encodeURIComponent('status = "published"');
  const out: PbRecord[] = [];
  for (let page = 1; ; page++) {
    const r = await fetch(`${PB}/api/collections/specialists/records?perPage=200&page=${page}&filter=${filter}`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`база не ответила: ${r.status}`);
    const res = await r.json();
    out.push(...res.items);
    if (page >= res.totalPages) break;
  }
  return out;
}

/** размеры кадра узнаём один раз — дальше они в памяти службы */
async function remoteKey(rec: PbRecord, name: string): Promise<string | null> {
  const key = `${FILES}/api/files/${rec.collectionId}/${rec.id}/${encodeURIComponent(name)}`;
  if (hasRemote(key)) return key;
  try {
    const size = await inferRemoteSize(key);
    registerRemote(key, { src: key, width: size.width, height: size.height, format: size.format } as ImageMetadata);
    return key;
  } catch {
    return null; // битый кадр не роняет страницу — пропускаем, как сборка
  }
}

async function cabinetCard(rec: PbRecord): Promise<Specialist | null> {
  const names = orderedPhotos(rec.page, rec.photos ?? []);
  const photos: string[] = [];
  // по 4 кадра за раз: не забиваем базу и память службы
  for (let i = 0; i < names.length; i += 4) {
    const keys = await Promise.all(names.slice(i, i + 4).map((n: string) => remoteKey(rec, n)));
    photos.push(...(keys.filter(Boolean) as string[]));
  }
  if (!photos.length) return null;
  return cardFromPage(rec.page, { slug: rec.slug, categorySlug: rec.categorySlug, name: rec.name, photos }) as Specialist;
}

/**
 * Наша карточка из базы: page — полный объект карточки (тот же JSON, что в git).
 * Кадр, который есть в src/assets, остаётся своим путём (нарезан при сборке);
 * которого нет — берём файл из базы по photoIndex (новая карточка конвейера
 * видна на сайте сразу, без сборки).
 */
async function ourCard(rec: PbRecord): Promise<Specialist | null> {
  const p = { ...(rec.page ?? {}) } as Specialist & { ownerEdits?: unknown };
  delete p.ownerEdits;
  const byPath: Record<string, string> = {};
  for (const [pbName, src] of Object.entries(rec.photoIndex ?? {})) byPath[src] = pbName;
  const one = async (path: string): Promise<string | null> => {
    if (!path || hasLocalImage(path)) return path || null;
    const pbName = byPath[path];
    return pbName ? remoteKey(rec, pbName) : null;
  };
  const photos = (await Promise.all((p.photos ?? []).map(one))).filter(Boolean) as string[];
  if (!photos.length) return null;
  const card = { ...p, photos } as Specialist;
  if (p.avatar) {
    const a = await one(p.avatar);
    if (a) card.avatar = a; else delete card.avatar;
  }
  return card;
}

async function load() {
  const recs = await fetchPublished();
  const cards: Specialist[] = [];
  const cabinetKeys: string[] = [];
  const edits: Record<string, OwnerEdits> = {};
  for (const rec of recs) {
    if (!rec.slug || !rec.categorySlug) continue;
    const p = rec.page ?? {};
    const key = `${rec.categorySlug}/${rec.slug}`;
    if (p.source === 'cabinet') {
      const card = await cabinetCard(rec);
      if (card) { cards.push(card); cabinetKeys.push(key); }
    } else {
      const card = await ourCard(rec);
      if (card) cards.push(card);
      if (p.ownerEdits) edits[key] = p.ownerEdits;
    }
  }
  // пустой ответ базы не обнуляет каталог: это сбой, а не «подрядчиков нет»
  if (!cards.length) throw new Error('база вернула пустой список подрядчиков');
  // порядок каталога — как был при сборке из git: наши по алфавиту адреса
  // (как файлы specialists/<кат>/<slug>.json), карточки из кабинета — следом
  const isCab = (c: Specialist) => cabinetKeys.includes(`${c.categorySlug}/${c.slug}`);
  const byPath = (x: Specialist, y: Specialist) => `${x.categorySlug}/${x.slug}`.localeCompare(`${y.categorySlug}/${y.slug}`, 'en');
  cards.sort((x, y) => Number(isCab(x)) - Number(isCab(y)) || (isCab(x) ? 0 : byPath(x, y)));
  applyLive(cards, edits, cabinetKeys);
  freshAt = Date.now();
}

/** подставить свежие данные базы (не чаще раза в 20 с; одна загрузка на всех) */
export async function refreshLive(): Promise<void> {
  if (Date.now() - freshAt < FRESH_MS) return;
  inflight ??= load()
    .catch((err) => {
      // база недоступна: работаем на последнем удачном состоянии
      console.error('live-data:', (err as Error).message);
      freshAt = Date.now() - FRESH_MS + 5_000; // повторить через 5 с, а не на каждом запросе
    })
    .finally(() => { inflight = null; });
  await inflight;
}

/** заголовок кэша для страниц с живыми данными: nginx держит их секунды */
export const LIVE_CACHE = 'public, max-age=0, s-maxage=10';
