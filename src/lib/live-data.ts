// САЙТ ИЗ БАЗЫ, этап 2 (05.11.2026): живые данные для страниц, которые рисует
// сервер. Раз в FRESH_MS забираем из базы всё опубликованное — карточки из
// кабинета и правки владельцев «ведём мы» — и подставляем в общие таблицы
// data/specialists.ts (applyLive). Каталоги, визитки, «Похожие», счётчики
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
import { registerRemote, hasRemote } from './images';
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

async function load() {
  const recs = await fetchPublished();
  const cabinet: Specialist[] = [];
  const edits: Record<string, OwnerEdits> = {};
  for (const rec of recs) {
    const p = rec.page ?? {};
    if (p.source === 'cabinet' && rec.slug && rec.categorySlug) {
      const card = await cabinetCard(rec);
      if (card) cabinet.push(card);
    } else if (p.ownerEdits && rec.slug && rec.categorySlug) {
      edits[`${rec.categorySlug}/${rec.slug}`] = p.ownerEdits;
    }
  }
  applyLive(cabinet, edits);
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
