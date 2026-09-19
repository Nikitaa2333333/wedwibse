// ============================================================
// ПОХОЖИЕ КАРТОЧКИ — блок «Похожие площадки» / «Похожие подрядчики»
// в конце страницы. Полная схема, веса и почему так — в RECOMMENDATIONS.md.
//
// ГЛАВНЫЙ ПРИНЦИП: рекомендации НЕ хранятся, а ВЫЧИСЛЯЮТСЯ на сборке
// из тех же данных, что и каталог (feed.ts, venues.ts, specialists.ts).
// Поэтому «фоновый режим при пополнении» получается сам собой: новая
// площадка попала в данные → следующая сборка пересчитала соседей и
// у неё, и у всех остальных. Хук, скрипт, таблица «рекомендации» —
// не нужны, и заводить их нельзя: любая сохранённая копия протухает.
// Когда данные переедут в PocketBase, эти же функции остаются:
// pb-pull отдаёт им тот же массив, только не из файлов, а из базы.
//
// ОЦЕНКА — взвешенная сумма ПОНЯТНЫХ признаков, а не «магия»: по каждому
// признаку начисляются баллы из таблицы весов ниже, кандидаты сортируются
// по сумме, ничьи разводит рейтинг и число отзывов. Любой результат
// можно объяснить словами («тот же тип, в 10 км, чек рядом») — это
// важно для отладки: рекомендация, которую нельзя объяснить, не чинится.
// Все ручки — в объектах *_WEIGHTS, в самих функциях чисел нет.
// ============================================================
import { FEED, type FeedVenue } from '../data/feed';
import { VENUES } from '../data/venues';
import { SPECIALISTS_BY_CATEGORY, hasProfile, type Specialist } from '../data/specialists';

/** сколько карточек показываем: ряд из трёх читается одним взглядом
 *  (тот же размер, что у «Площадок из этой статьи») */
export const SIMILAR_LIMIT = 3;

// ============ ПЛОЩАДКИ ============
// Признаки — плоские поля карточки ленты (то, по чему человек и фильтрует
// каталог: тип, локация, вместимость, чек) плюс координата из карточки.
export const VENUE_WEIGHTS = {
  /** тот же тип площадки (оранжерея → оранжерея) */
  sameType: 3,
  /** та же локация каталога (город/район) */
  sameCity: 2,
  /** расстояние по координатам, км → баллы; первый подошедший порог.
   *  ≤5 км — соседи на одной территории (две оранжереи одного владельца,
   *  два зала одного оператора): это самая честная рекомендация из
   *  возможных — «на 100 метрах отсюда стоит ещё одна». */
  distance: [
    { km: 5, score: 3 },
    { km: 20, score: 2 },
    { km: 45, score: 1 },
  ],
  /** вместимость: отношение меньшей к большей → баллы */
  capacity: [
    { ratio: 0.7, score: 2 },
    { ratio: 0.45, score: 1 },
  ],
  /** средний чек: отношение меньшего к большему → баллы */
  check: [
    { ratio: 0.8, score: 2 },
    { ratio: 0.6, score: 1 },
  ],
  /** у обеих прайс закрыт («по запросу», «депозитная система») — это
   *  тоже сходство: обе живут по одной модели. Одна с ценой, другая
   *  без — не штрафуем, просто ноль: сравнивать нечего. */
  bothNoPrice: 1,
};

const geoBySlug = new Map(
  VENUES.filter((v) => v.contacts.geo).map((v) => [v.slug, v.contacts.geo!] as const)
);

/** расстояние между точками по дуге, км (формула гаверсинуса) */
function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** отношение меньшего числа к большему: 1 — равны, → 0 — далеко */
function closeness(a: number, b: number): number {
  return a && b ? Math.min(a, b) / Math.max(a, b) : 0;
}

/** первый порог из таблицы, под который попало значение */
function stepScore<K extends string>(
  table: ({ [P in K]: number } & { score: number })[],
  key: K,
  value: number,
  fits: (value: number, threshold: number) => boolean
): number {
  for (const row of table) if (fits(value, row[key])) return row.score;
  return 0;
}

export function venueScore(a: FeedVenue, b: FeedVenue): number {
  const w = VENUE_WEIGHTS;
  let score = 0;

  if (a.type === b.type) score += w.sameType;
  if (a.city === b.city) score += w.sameCity;

  const ga = geoBySlug.get(a.slug);
  const gb = geoBySlug.get(b.slug);
  if (ga && gb) score += stepScore(w.distance, 'km', distanceKm(ga, gb), (v, t) => v <= t);

  score += stepScore(w.capacity, 'ratio', closeness(a.capacityMax, b.capacityMax), (v, t) => v >= t);

  if (a.checkFrom && b.checkFrom) {
    score += stepScore(w.check, 'ratio', closeness(a.checkFrom, b.checkFrom), (v, t) => v >= t);
  } else if (!a.checkFrom && !b.checkFrom) {
    score += w.bothNoPrice;
  }

  return score;
}

/** Похожие площадки для страницы площадки. Кандидаты — вся лента без неё
 *  самой; порядок — по баллам, ничья → рейтинг → число отзывов. Список
 *  никогда не пустой, пока в каталоге есть хоть одна другая площадка:
 *  без порога отсечения, слабое сходство лучше пустого конца страницы
 *  (порог имеет смысл включить, когда площадок станут сотни — см. RECOMMENDATIONS.md). */
export function similarVenues(slug: string, limit = SIMILAR_LIMIT): FeedVenue[] {
  const venues = FEED.filter((i): i is FeedVenue => i.kind === 'venue');
  const self = venues.find((v) => v.slug === slug);
  if (!self) return [];

  return venues
    .filter((v) => v.slug !== slug)
    .map((v) => ({ v, score: venueScore(self, v) }))
    .sort((x, y) => y.score - x.score || y.v.rating - x.v.rating || y.v.reviews - x.v.reviews)
    .slice(0, limit)
    .map((x) => x.v);
}

// ============ ПОДРЯДЧИКИ ============
// Кандидаты — ТОЛЬКО та же категория: похожий на ведущего — ведущий,
// это не балл, а жёсткое условие. Дальше — цена, город, стиль и прочие
// значения фильтров категории, опыт.
export const SPECIALIST_WEIGHTS = {
  /** цена «от»: отношение меньшей к большей → баллы */
  price: [
    { ratio: 0.75, score: 3 },
    { ratio: 0.5, score: 2 },
    { ratio: 0.3, score: 1 },
  ],
  /** у обоих цена по запросу */
  bothNoPrice: 1,
  /** есть общий город/округ работы */
  sharedCity: 2,
  /** за каждый общий стиль (styles) — балл, не больше maxStyles */
  perStyle: 1,
  maxStyles: 2,
  /** за каждое совпавшее значение в карте filters — балл, не больше maxFilters */
  perFilter: 1,
  maxFilters: 3,
  /** разница в опыте не больше experienceYears лет */
  experience: 1,
  experienceYears: 3,
};

const asList = (v: string | string[] | undefined): string[] => (Array.isArray(v) ? v : v ? [v] : []);
const overlap = (a: string[] | undefined, b: string[] | undefined): number =>
  (a ?? []).filter((x) => (b ?? []).includes(x)).length;

export function specialistScore(a: Specialist, b: Specialist): number {
  const w = SPECIALIST_WEIGHTS;
  let score = 0;

  if (a.priceFrom && b.priceFrom) {
    score += stepScore(w.price, 'ratio', closeness(a.priceFrom, b.priceFrom), (v, t) => v >= t);
  } else if (!a.priceFrom && !b.priceFrom) {
    score += w.bothNoPrice;
  }

  if (overlap(a.cities, b.cities)) score += w.sharedCity;
  score += Math.min(overlap(a.styles, b.styles) * w.perStyle, w.maxStyles);

  // Карта фильтров съёмочных категорий: у обоих есть ключ и есть общее
  // значение — балл за ключ (не за каждое значение: «стиль» с тремя
  // совпадениями не должен перевешивать «город»).
  let filterHits = 0;
  for (const key of Object.keys(a.filters ?? {})) {
    if (overlap(asList(a.filters?.[key]), asList(b.filters?.[key]))) filterHits += w.perFilter;
  }
  score += Math.min(filterHits, w.maxFilters);

  if (
    a.experienceYears &&
    b.experienceYears &&
    Math.abs(a.experienceYears - b.experienceYears) <= w.experienceYears
  ) {
    score += w.experience;
  }

  return score;
}

/** Похожие подрядчики для визитки: та же категория, без демо-заглушек
 *  (стоковые кадры за чужую работу не выдаём — правило каталога), только
 *  те, у кого есть своя визитка (hasProfile — иначе ссылка в 404), и без
 *  него самого. Пара «фото + видео» стоит в двух категориях — кандидат
 *  считается один раз, по slug. */
export function similarSpecialists(s: Specialist, limit = SIMILAR_LIMIT): Specialist[] {
  const pool = SPECIALISTS_BY_CATEGORY[s.categorySlug] ?? [];
  const seen = new Set<string>([s.slug]);

  return pool
    .filter((c) => !c.demo && hasProfile(c) && !seen.has(c.slug) && seen.add(c.slug))
    .map((c) => ({ c, score: specialistScore(s, c) }))
    .sort(
      (x, y) =>
        y.score - x.score || (y.c.rating ?? 0) - (x.c.rating ?? 0) || (y.c.reviews ?? 0) - (x.c.reviews ?? 0)
    )
    .slice(0, limit)
    .map((x) => x.c);
}
