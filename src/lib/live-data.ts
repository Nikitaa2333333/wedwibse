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
import { venueFromPage } from './cabinet-venue.mjs';
import { applyVenueEdits, applyFeedEdits, hideVenuePhotos } from './venue-edits.mjs';
import { catalogImage, catalogEntries, setCatalogImages, hasLocalImage } from './images';
import { applyLive, type OwnerEdits, type Specialist } from '../data/specialists';
import { applyLiveVenues, type Venue } from '../data/venues';
import { applyLiveFeed, STATIC_FEED, FEED, type FeedVenue } from '../data/feed';
import { applyLiveReviews, venueKey, specialistKey, venueReviews, specialistReviews, type ReviewsBlock } from '../data/reviews';
import { SPECIALISTS_BY_CATEGORY } from '../data/specialists';

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

async function fetchPublished(collection = 'specialists'): Promise<PbRecord[]> {
  const filter = encodeURIComponent('status = "published"');
  const out: PbRecord[] = [];
  for (let page = 1; ; page++) {
    const r = await fetch(`${PB}/api/collections/${collection}/records?perPage=200&page=${page}&filter=${filter}`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`база не ответила: ${r.status}`);
    const res = await r.json();
    out.push(...res.items);
    if (page >= res.totalPages) break;
  }
  return out;
}

// Реестр кадров каталога собирается заново на каждой загрузке (images.ts,
// setCatalogImages): замеренное раньше переносится без сети, снятое выпадает.
type Reg = Map<string, ImageMetadata>;
const MEASURE_MS = 5000;
/** последняя удачная версия карточки: сбой замера фото не убирает её с сайта */
const lastCards = new Map<string, Specialist>();
const lastVenues = new Map<string, Venue>();
/** был сбой замера в этой загрузке — повторить скоро, а не через 20 с */
let measureFailed = false;

/** перенести в новый реестр все кадры каталога, на которые ссылается объект */
function carry(obj: unknown, next: Reg) {
  for (const m of JSON.stringify(obj).matchAll(/"(https?:\/\/[^"]+\/api\/files\/[^"]+)"/g)) {
    const meta = catalogImage(m[1]);
    if (meta) next.set(m[1], meta);
  }
}

/** размеры кадра узнаём один раз — дальше они в памяти службы */
async function remoteKey(rec: PbRecord, name: string, next: Reg): Promise<string | null> {
  const tail = `/api/files/${rec.collectionId}/${rec.id}/${encodeURIComponent(name)}`;
  const key = `${FILES}${tail}`;
  const known = next.get(key) ?? catalogImage(key);
  if (known) { next.set(key, known); return key; }
  try {
    // не дольше 5 с: подвисшая отдача файлов не должна держать загрузку
    // каталога (05.11.2026). Адрес — публичный: inferRemoteSize пускает
    // только адреса из image.remotePatterns, внутренний 127.0.0.1 там нет.
    const size = await Promise.race([
      inferRemoteSize(key),
      new Promise<never>((_, no) => setTimeout(() => no(new Error('замер дольше 5 с')), MEASURE_MS)),
    ]);
    next.set(key, { src: key, width: size.width, height: size.height, format: size.format } as ImageMetadata);
    return key;
  } catch {
    measureFailed = true;
    return null; // битый кадр не роняет страницу — пропускаем, как сборка
  }
}

async function cabinetCard(rec: PbRecord, next: Reg): Promise<Specialist | null> {
  const names = orderedPhotos(rec.page, rec.photos ?? []);
  const photos: string[] = [];
  // по 4 кадра за раз: не забиваем базу и память службы
  for (let i = 0; i < names.length; i += 4) {
    const keys = await Promise.all(names.slice(i, i + 4).map((n: string) => remoteKey(rec, n, next)));
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
async function ourCard(rec: PbRecord, next: Reg): Promise<Specialist | null> {
  const p = { ...(rec.page ?? {}) } as Specialist & { ownerEdits?: unknown };
  delete p.ownerEdits;
  const byPath: Record<string, string> = {};
  for (const [pbName, src] of Object.entries(rec.photoIndex ?? {})) byPath[src] = pbName;
  const one = async (path: string): Promise<string | null> => {
    if (!path || hasLocalImage(path)) return path || null;
    const pbName = byPath[path];
    return pbName ? remoteKey(rec, pbName, next) : null;
  };
  // фото, которые владелец «ведём мы» поменял сам (07.11): имена файлов
  // карточки; кадр, нарезанный при сборке, остаётся своим путём (photoIndex)
  const ownPhotos = (rec.page as { ownerEdits?: { photos?: string[] } } | undefined)?.ownerEdits?.photos;
  const byName = async (pbName: string): Promise<string | null> => {
    const src = rec.photoIndex?.[pbName];
    return src && hasLocalImage(src) ? src : remoteKey(rec, pbName, next);
  };
  const photos = (await Promise.all(Array.isArray(ownPhotos) && ownPhotos.length ? ownPhotos.map(byName) : (p.photos ?? []).map(one))).filter(Boolean) as string[];
  if (!photos.length) return null;
  const card = { ...p, photos } as Specialist;
  if (p.avatar) {
    const a = await one(p.avatar);
    if (a) card.avatar = a; else delete card.avatar;
  }
  // портрет, который владелец «ведём мы» поставил сам (07.11): файл карточки
  // в базе; он же идёт в полный кадр «О себе» — прежний наш портрет уже не он
  const own = (rec.page as { ownerEdits?: { avatar?: string } } | undefined)?.ownerEdits?.avatar;
  if (own) {
    const a = await remoteKey(rec, own, next);
    if (a) { card.avatar = a; card.portrait = a; }
  }
  return card;
}

// ---------- площадки (этап 3) ----------
const priceFmt = new Intl.NumberFormat('ru-RU');
/** все пути кадров внутри страницы площадки (блоки, залы, первый экран) */
/** null — кадр из базы не замерился: сырой путь /venues/… уронил бы resolveImage */
async function mapVenueImages(rec: PbRecord, node: unknown, next: Reg): Promise<unknown | null> {
  const byPath: Record<string, string> = {};
  for (const [pbName, src] of Object.entries(rec.photoIndex ?? {})) byPath[src] = pbName;
  let broken = false;
  const walk = async (v: unknown): Promise<unknown> => {
    if (typeof v === 'string') {
      if (!/^\/venues\/.+\.(webp|jpe?g|png)$/i.test(v) || hasLocalImage(v)) return v;
      // пути вне photoIndex (логотип из public/) остаются как есть
      if (!byPath[v]) return v;
      const key = await remoteKey(rec, byPath[v], next);
      if (!key) broken = true;
      return key ?? v;
    }
    if (Array.isArray(v)) return Promise.all(v.map(walk));
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v)) out[k] = await walk(x);
      return out;
    }
    return v;
  };
  const out = await walk(node);
  return broken ? null : out;
}

/** карточка каталога: записанная руками (feed.ts) или собранная из полей базы */
function feedOf(rec: PbRecord & Record<string, any>, venue: Venue): FeedVenue {
  const hand = STATIC_FEED.find((f) => f.slug === rec.slug);
  // правки владельца «ведём мы» (тип, вместимость, чек) — поверх записанной руками (09.11)
  if (hand) return applyFeedEdits(hand, rec.page?.ownerEdits) as FeedVenue;
  const cap = Number(rec.capacityBanquet) || 0;
  const check = Number(rec.checkFrom) || 0;
  const photos = JSON.stringify(venue).match(/"(\/venues\/[^"]+\.(?:webp|jpe?g|png)|https?:\/\/[^"]+\/api\/files\/[^"]+)"/gi)?.map((x) => x.slice(1, -1)) ?? [];
  return {
    kind: 'venue',
    slug: rec.slug,
    name: rec.name || venue.name,
    // у площадки из кабинета бирка «Тип · Топоним» (cabinet-venue.mjs): в карточку
    // каталога тип и место идут порознь, как у записанных руками
    ...(rec.page?.source === 'cabinet'
      ? { city: rec.city || venue.kicker.split(' · ')[1] || 'Москва', type: venue.kicker.split(' · ')[0] }
      : { city: rec.city || (venue as any).city || 'Москва', type: (venue as any).kicker || 'Площадка' }),
    // фильтры как у wedwed (12.11): колонки записи, их ставит хук одобрения из анкеты
    typeSlug: rec.type || undefined,
    districts: Array.isArray(rec.districts) ? rec.districts : [],
    features: Array.isArray(rec.features) ? rec.features : [],
    capacityMax: cap,
    capacity: cap ? `до ${cap} гостей` : 'вместимость по запросу',
    ...(check ? { checkFrom: check } : {}),
    avgCheck: check ? `от ${priceFmt.format(check)} ₽` : 'чек по запросу',
    media: [...new Set(photos)].slice(0, 4),
  } as FeedVenue;
}

/**
 * Площадка из кабинета (page.source = 'cabinet', форма buildPage) → Venue.
 * Кадры — файлы карточки в базе, как у подрядчика из кабинета (cabinetCard).
 * null — ни один кадр не замерился.
 */
async function cabinetVenue(rec: PbRecord, next: Reg): Promise<Venue | null> {
  const names = orderedPhotos(rec.page, rec.photos ?? []);
  const photos: string[] = [];
  const byName = new Map<string, string>();
  for (let i = 0; i < names.length; i += 4) {
    const part = names.slice(i, i + 4);
    const keys = await Promise.all(part.map((n: string) => remoteKey(rec, n, next)));
    keys.forEach((k, j) => { if (k) { photos.push(k); byName.set(part[j], k); } });
  }
  if (!photos.length) return null;
  return venueFromPage(rec.page, { slug: rec.slug, name: rec.name, photos, fileOf: (n: string) => byName.get(n) }) as Venue;
}

/**
 * Строка «5,0 — рейтинг · N отзывов» в цифрах площадки — данные Яндекс Карт,
 * сняты с сайта 12.11.2026 (отзывы теперь только невест). В git убраны, а в
 * page записей базы остались; перезаливать page нельзя — затрёт правки
 * владельцев («ведём мы»), поэтому снимаем при чтении.
 */
function dropMapsRating(v: any) {
  const keep = (items: any) => Array.isArray(items) ? items.filter((i) => !/^рейтинг/i.test(String(i?.label ?? ''))) : items;
  v.stats = keep(v.stats);
  for (const b of v.blocks ?? []) if (b?.type === 'stats') b.items = keep(b.items);
}

async function loadVenues(next: Reg) {
  const recs = await fetchPublished('venues');
  // в базе площадок ещё нет — остаёмся на данных сборки, каталог не обнуляем
  if (!recs.length) return null;
  const venues: Venue[] = [];
  const feed: FeedVenue[] = [];
  for (const rec of recs) {
    if (!rec.slug || !rec.page) continue;
    // одна битая запись не останавливает обновление всего каталога (05.11.2026)
    try {
      // площадка из кабинета — своя форма page, её переводим в Venue;
      // площадка конвейера — page уже Venue, меняем только пути кадров
      // «ведём мы»: убранные владельцем кадры — до подмены путей на файлы сборки (09.11)
      let venue = (rec.page.source === 'cabinet'
        ? await cabinetVenue(rec, next)
        : await mapVenueImages(rec, hideVenuePhotos(rec.page, rec.page.ownerEdits?.hiddenPhotos), next)) as Venue | null;
      // площадка «ведём мы»: правки владельца (строки, тарифы залов) поверх нашей страницы (09.11)
      if (venue && rec.page.source !== 'cabinet') venue = applyVenueEdits(venue, rec.page.ownerEdits) as Venue;
      if (venue) dropMapsRating(venue);
      if (venue) lastVenues.set(rec.slug, venue);
      else {
        // кадр не замерился — прошлая удачная версия площадки, а без неё площадку пропускаем
        venue = lastVenues.get(rec.slug) ?? null;
        if (!venue) { console.error(`live-data: площадка ${rec.slug} — нет кадров, пропущена`); continue; }
        carry(venue, next);
      }
      venues.push(venue);
      feed.push(feedOf(rec as any, venue));
    } catch (err) {
      console.error(`live-data: площадка ${rec.slug}:`, (err as Error).message);
    }
  }
  if (!venues.length) return null;
  // порядок каталога — как в ленте feed.ts, новые площадки — следом
  const pos = (slug: string) => { const i = STATIC_FEED.findIndex((f) => f.slug === slug); return i < 0 ? 1e6 : i; };
  feed.sort((a, b) => pos(a.slug) - pos(b.slug));
  venues.sort((a, b) => pos(a.slug) - pos(b.slug));
  return { venues, feed };
}

async function loadSpecialists(next: Reg) {
  const recs = await fetchPublished();
  const cards: Specialist[] = [];
  const cabinetKeys: string[] = [];
  const edits: Record<string, OwnerEdits> = {};
  for (const rec of recs) {
    if (!rec.slug || !rec.categorySlug) continue;
    const p = rec.page ?? {};
    const key = `${rec.categorySlug}/${rec.slug}`;
    try {
      const fresh = p.source === 'cabinet' ? await cabinetCard(rec, next) : await ourCard(rec, next);
      // ни один кадр не замерился (база моргнула) — прошлая удачная версия, а не 404
      const card = fresh ?? lastCards.get(key) ?? null;
      if (!card) continue;
      if (fresh) lastCards.set(key, fresh); else carry(card, next);
      cards.push(card);
      if (p.source === 'cabinet') cabinetKeys.push(key);
      else if (p.ownerEdits) edits[key] = p.ownerEdits;
    } catch (err) {
      console.error(`live-data: карточка ${key}:`, (err as Error).message);
    }
  }
  // пустой ответ базы не обнуляет каталог: это сбой, а не «подрядчиков нет»
  if (!cards.length) throw new Error('база вернула пустой список подрядчиков');
  // порядок каталога — как был при сборке из git: наши по алфавиту адреса
  // (как файлы specialists/<кат>/<slug>.json), карточки из кабинета — следом
  const isCab = (c: Specialist) => cabinetKeys.includes(`${c.categorySlug}/${c.slug}`);
  const byPath = (x: Specialist, y: Specialist) => `${x.categorySlug}/${x.slug}`.localeCompare(`${y.categorySlug}/${y.slug}`, 'en');
  cards.sort((x, y) => Number(isCab(x)) - Number(isCab(y)) || (isCab(x) ? 0 : byPath(x, y)));
  return { cards, edits, cabinetKeys };
}

// ---------- отзывы невест (12.11.2026) ----------
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_NOM = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];

/** одобренные отзывы → таблица по карточкам; сбой — остаётся прежняя */
async function loadReviews(): Promise<Map<string, ReviewsBlock>> {
  const filter = encodeURIComponent('status = "approved"');
  const fields = 'id,collectionId,rating,text,authorName,weddingMonth,photos,created,expand.venue.slug,expand.specialist.slug,expand.specialist.categorySlug';
  const items: any[] = [];
  for (let page = 1; ; page++) {
    const r = await fetch(`${PB}/api/collections/reviews/records?perPage=500&page=${page}&sort=-created&filter=${filter}&expand=venue,specialist&fields=${fields}`, { signal: AbortSignal.timeout(8000) });
    if (r.status === 404) return new Map(); // коллекции ещё нет (база до миграции)
    if (!r.ok) throw new Error(`отзывы: база ответила ${r.status}`);
    const res = await r.json();
    items.push(...res.items);
    if (page >= res.totalPages) break;
  }
  const out = new Map<string, ReviewsBlock>();
  for (const it of items) {
    const v = it.expand?.venue;
    const s = it.expand?.specialist;
    const key = v?.slug ? venueKey(v.slug) : s?.slug ? specialistKey(s.categorySlug, s.slug) : '';
    if (!key) continue;
    const d = new Date(String(it.created).replace(' ', 'T'));
    const [y, m] = String(it.weddingMonth || '').split('-').map(Number);
    const file = (n: string, thumb?: string) => `${FILES}/api/files/${it.collectionId}/${it.id}/${encodeURIComponent(n)}${thumb ? `?thumb=${thumb}` : ''}`;
    const block = out.get(key) ?? { rating: 0, total: 0, items: [] };
    block.items.push({
      id: it.id,
      author: it.authorName,
      date: isNaN(+d) ? '' : `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
      rating: it.rating,
      text: it.text,
      wedding: y && m ? `${MONTHS_NOM[m - 1]} ${y}` : undefined,
      photos: (it.photos ?? []).map((n: string) => ({ thumb: file(n, '480x0'), full: file(n, '1200x0') })),
    });
    out.set(key, block);
  }
  for (const b of out.values()) {
    b.total = b.items.length;
    b.rating = Math.round((b.items.reduce((a, r) => a + r.rating, 0) / b.total) * 10) / 10;
  }
  return out;
}

/** оценка и число отзывов — на плитки каталога и визитки (поля rating/reviews) */
function decorateRatings() {
  for (const f of FEED) {
    if (f.kind !== 'venue') continue;
    const b = venueReviews(f.slug);
    f.rating = b?.rating;
    f.reviews = b?.total;
  }
  for (const list of Object.values(SPECIALISTS_BY_CATEGORY)) {
    for (const s of list) {
      const b = specialistReviews(s.categorySlug, s.slug);
      s.rating = b?.rating;
      s.reviews = b?.total;
    }
  }
}

async function load() {
  measureFailed = false;
  const next: Reg = new Map();
  // площадки и подрядчики — раздельно: сбой одних не трогает других
  const v = await loadVenues(next).catch((err) => { console.error('live-data, площадки:', (err as Error).message); return null; });
  const s = await loadSpecialists(next).catch((err) => { console.error('live-data, подрядчики:', (err as Error).message); return null; });
  // отзывы — сами по себе: сбой не трогает карточки, остаётся прежняя таблица.
  // Грузим ДО подмены: подмена ниже идёт одним синхронным куском
  const rv = await loadReviews().catch((err) => { console.error('live-data, отзывы:', (err as Error).message); return null; });
  // часть осталась на прежних данных — их кадры остаются в реестре
  if (!v || !s) carryAll(next);
  // подмена — синхронно, одним куском: запрос не видит половину обновления
  setCatalogImages(next);
  if (v) { applyLiveVenues(v.venues); applyLiveFeed(v.feed); }
  if (s) applyLive(s.cards, s.edits, s.cabinetKeys);
  if (rv) applyLiveReviews(rv);
  decorateRatings();
  if (!s) throw new Error('подрядчики не обновлены');
  // кадр не замерился — повторить через 5 с, остальное как обычно
  freshAt = measureFailed ? Date.now() - FRESH_MS + 5_000 : Date.now();
}

/** весь прежний реестр — в новый (часть каталога осталась на старых данных) */
function carryAll(next: Reg) {
  for (const [key, meta] of catalogEntries()) if (!next.has(key)) next.set(key, meta);
}

let everLoaded = false;
/**
 * Подставить свежие данные базы (не чаще раза в 20 с; одна загрузка на всех).
 * Страница ждёт загрузку только самую первую после запуска службы (и не
 * дольше 10 с — дальше отрисуется на снимке из git). Дальше — «отдать старое,
 * обновить в фоне»: раньше каждый 20-секундный запрос ждал всю загрузку
 * базы и замеры кадров (05.11.2026).
 */
export async function refreshLive(): Promise<void> {
  if (Date.now() - freshAt < FRESH_MS) return;
  inflight ??= load()
    .then(() => { everLoaded = true; })
    .catch((err) => {
      // база недоступна: работаем на последнем удачном состоянии
      console.error('live-data:', (err as Error).message);
      freshAt = Date.now() - FRESH_MS + 5_000; // повторить через 5 с, а не на каждом запросе
    })
    .finally(() => { inflight = null; });
  if (everLoaded) return;
  await Promise.race([inflight, new Promise((ok) => setTimeout(ok, 10_000))]);
}

/** заголовок кэша для страниц с живыми данными: nginx держит их секунды */
export const LIVE_CACHE = 'public, max-age=0, s-maxage=10';
