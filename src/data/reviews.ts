// ============ ОТЗЫВЫ НЕВЕСТ (12.11.2026, docs/cabinet/REVIEWS.md) ============
// Единственный источник — коллекция reviews в базе: отзыв пишет невеста со
// своей учёткой, на сайте он появляется после одобрения модератором.
// Отзывы с Яндекс Карт (src/data/reviews/*.json, scripts/maps-reviews.mjs)
// сняты целиком вместе с оценками — решение Никиты 12.11.2026.
//
// Таблицу заполняет live-data (раз в 20 с, вместе с карточками). Оценка и
// число — считаются из одобренных; показываем все одобренные: что видно на
// сайте, решает модератор, а не порог по звёздам.

export interface CardReview {
  id: string;
  author: string;
  /** человеку: «12 ноября 2026» — когда написан */
  date: string;
  rating: number;
  text: string;
  /** «август 2026» — месяц свадьбы, если указан */
  wedding?: string;
  /** фото отзыва: превью и полный кадр (файлы базы) */
  photos: { thumb: string; full: string }[];
}

export interface ReviewsBlock {
  /** средняя из одобренных, до десятых */
  rating: number;
  total: number;
  /** свежие сверху */
  items: CardReview[];
}

let TABLE = new Map<string, ReviewsBlock>();

export const venueKey = (slug: string) => `venue:${slug}`;
export const specialistKey = (categorySlug: string, slug: string) => `specialist:${categorySlug}/${slug}`;

/** подмена таблицы целиком (live-data) */
export function applyLiveReviews(next: Map<string, ReviewsBlock>) {
  TABLE = next;
}

export function venueReviews(slug: string): ReviewsBlock | null {
  return TABLE.get(venueKey(slug)) ?? null;
}

export function specialistReviews(categorySlug: string, slug: string): ReviewsBlock | null {
  return TABLE.get(specialistKey(categorySlug, slug)) ?? null;
}

/** адрес формы отзыва о карточке */
export function reviewFormUrl(kind: 'venue' | 'specialist', slug: string, categorySlug?: string): string {
  const q = kind === 'venue' ? `ploshchadka=${slug}` : `podryadchik=${categorySlug}/${slug}`;
  return `/moy/otzyv/?${q}`;
}
