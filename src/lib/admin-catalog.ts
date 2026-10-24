// Каталог для админки — НАСТОЯЩИЕ карточки сайта (площадки + подрядчики)
// одной таблицей. Вживую то же придёт из базы (`venues`, `specialists`
// с `owner`, `version`); заполненность считается той же формулой, что
// у прогресса анкеты в кабинете.
import { VENUES } from '../data/venues';
import { REAL_SPECIALISTS, specialistRole, specialistUrl } from '../data/specialists';

export interface CatalogRow {
  key: string;
  kind: 'venue' | 'specialist';
  name: string;
  category: string;
  url: string;
  cover?: string;
  photos: number;
  /** заполненность карточки, 0–100 */
  filled: number;
  hasText: boolean;
  hasPrice: boolean;
}

const pct = (photos: number, text: boolean, price: boolean) =>
  Math.round(Math.min(photos, 50) / 50 * 50 + (text ? 30 : 0) + (price ? 20 : 0));

export const CATALOG: CatalogRow[] = [
  ...VENUES.map((v) => {
    const photos = v.gallery?.length ?? 0;
    const hasText = Boolean(v.lead);
    const hasPrice = Boolean(v.terms?.length);
    return {
      key: `venue:${v.slug}`,
      kind: 'venue' as const,
      name: v.name,
      category: 'Площадка',
      url: `/moskva/ploshchadki/${v.slug}/`,
      cover: v.hero?.image,
      photos,
      filled: pct(photos, hasText, hasPrice),
      hasText,
      hasPrice,
    };
  }),
  ...REAL_SPECIALISTS.filter((s) => s.photos.length > 0).map((s) => {
    const hasText = Boolean(s.story?.length || s.bio);
    const hasPrice = Boolean(s.priceFrom);
    return {
      key: `specialist:${s.slug}`,
      kind: 'specialist' as const,
      name: s.name,
      category: specialistRole(s),
      url: specialistUrl(s),
      cover: s.photos[0],
      photos: s.photos.length,
      filled: pct(s.photos.length, hasText, hasPrice),
      hasText,
      hasPrice,
    };
  }),
];

/** Карточка по ключу из заглушек (`venue:slug` / `specialist:slug`). */
export function cardByKey(key: string): CatalogRow | undefined {
  return CATALOG.find((c) => c.key === key);
}

// ЗАГЛУШКА «Интереса» за 7 дней: вживую — журнал открытий контактов
// (считает наш сервер, CABINET.md §18) и сохранения в избранное. Числа
// стабильны между сборками: считаются от имени карточки, не случайно.
const seed = (s: string) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
export interface InterestRow { key: string; views: number; saves: number; opens: number; prevOpens: number }
export const INTEREST: InterestRow[] = CATALOG.map((c) => {
  const h = seed(c.name);
  const views = 120 + (h % 900) + c.photos * 6;
  const saves = Math.round(views * (0.03 + (h % 7) / 100));
  const opens = Math.round(views * (0.02 + (h % 5) / 100));
  const prevOpens = Math.max(0, opens + ((h >> 3) % 9) - 4);
  return { key: c.key, views, saves, opens, prevOpens };
});
