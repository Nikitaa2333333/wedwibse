// ============================================================
// ЛЕНТА ПЛОЩАДОК — раздел 2 основного меню.
// Все карточки — реальные площадки каталога (демо-карточки сняты
// 13.09.2026: семи настоящих хватает на ритм ленты, а выдуманные
// мешали бы заливке в базу). Рейтинг и число отзывов — с Яндекс.Карт,
// те же цифры, что в src/data/reviews. Позже массив заменяется
// выборкой из PocketBase (плоские колонки записи venues).
//
// Фильтр и мозаика карточек — тот же паттерн, что у «Специалистов»
// (см. data/specialists.ts, pages/moskva/podryadchiki/vedushchie):
// FilterGroup[] уходит в общие <FilterBar>/<FilterSheet>, у карточки — числовые
// поля для бакетов (capacityMax, checkFrom), лейблы — отдельно для показа.
// ============================================================
import type { FilterGroup } from './specialists';

export interface FeedVenue {
  kind: 'venue';
  slug: string;
  name: string;
  city: string;
  type: string;
  /** числа для фильтра-бакета; строки ниже — то, что видно на карточке */
  capacityMax: number;
  capacity: string;
  /** нет открытого прайса — поля нет, и карточка не попадает в бакеты чека */
  checkFrom?: number;
  avgCheck: string;
  rating: number;
  reviews: number;
  /** фото или видео площадки: листаются вбок */
  media: string[];
}

export interface FeedAd {
  kind: 'ad';
  title: string;
  note: string;
  href: string;
  media: string;
}

export type FeedItem = FeedVenue | FeedAd;

const RL = '/venues/river-loft';
const FD = '/venues/forest-dew';
const DTL = '/venues/due-to-love';
const SPARK = '/venues/spark-hall';
const LED = '/venues/led';
const FP = '/venues/fish-point';
const OTR = '/venues/otrazhenie';

const venues: FeedVenue[] = [
  {
    kind: 'venue',
    slug: 'river-loft',
    name: 'Ривер Лофт',
    city: 'Подольск',
    type: 'Лофт',
    capacityMax: 100,
    capacity: 'до 100 гостей',
    checkFrom: 5000,
    avgCheck: 'от 5 000 ₽',
    rating: 5,
    reviews: 151,
    media: [`${RL}/gal/g8.webp`, `${RL}/gal/g2.webp`, `${RL}/gal/g5.webp`, `${RL}/welcome/w1.webp`],
  },
  {
    kind: 'venue',
    slug: 'forest-dew',
    name: 'Лесная Роса',
    city: 'Подольск',
    type: 'Оранжерея',
    capacityMax: 70,
    capacity: 'до 70 гостей',
    checkFrom: 9000,
    avgCheck: 'от 9 000 ₽',
    rating: 5,
    reviews: 279,
    media: [`${FD}/gal/g1.webp`, `${FD}/s2-hall.webp`, `${FD}/gal/g6.webp`, `${FD}/gal/g3.webp`],
  },
  {
    kind: 'venue',
    slug: 'due-to-love',
    name: 'Из-за любви',
    city: 'Подольск',
    type: 'Оранжерея',
    capacityMax: 60,
    capacity: 'до 60 гостей',
    checkFrom: 9000,
    avgCheck: 'от 9 000 ₽',
    rating: 5,
    reviews: 141,
    media: [`${DTL}/p58.webp`, `${DTL}/p14.webp`, `${DTL}/p28.webp`, `${DTL}/p74.webp`],
  },
  {
    kind: 'venue',
    slug: 'spark-hall',
    name: 'Spark Hall',
    city: 'Красногорск',
    type: 'Банкетный зал',
    capacityMax: 120,
    capacity: 'до 120 гостей',
    avgCheck: 'цена по запросу',
    rating: 4.5,
    reviews: 16,
    media: [`${SPARK}/hero-main.webp`, `${SPARK}/gal/g1.webp`, `${SPARK}/gal/g2.webp`, `${SPARK}/gal/g3.webp`],
  },
  {
    kind: 'venue',
    slug: 'led',
    name: 'LЁD',
    city: 'Красногорск',
    type: 'Оранжерея',
    capacityMax: 60,
    capacity: 'до 60 гостей',
    avgCheck: 'цена по запросу',
    rating: 4.5,
    reviews: 16,
    media: [`${LED}/hero-main.webp`, `${LED}/gal/g1.webp`, `${LED}/gal/g2.webp`, `${LED}/gal/g3.webp`],
  },
  {
    kind: 'venue',
    slug: 'fish-point',
    name: 'Fish Point',
    city: 'Подольск',
    type: 'Банкетный зал',
    capacityMax: 200,
    capacity: 'до 200 гостей',
    avgCheck: 'депозитная система',
    rating: 5,
    reviews: 2586,
    media: [`${FP}/p40.webp`, `${FP}/p03.webp`, `${FP}/p21.webp`, `${FP}/p35.webp`],
  },
  {
    kind: 'venue',
    slug: 'otrazhenie',
    name: 'Отражение',
    city: 'Можайский район',
    type: 'Оранжерея',
    capacityMax: 60,
    capacity: 'до 60 гостей',
    checkFrom: 8000,
    avgCheck: 'от 8 000 ₽',
    rating: 4.4,
    reviews: 10,
    media: [`${OTR}/p31.webp`, `${OTR}/p33.webp`, `${OTR}/p12.webp`, `${OTR}/p21.webp`],
  },
];

const ad: FeedAd = {
  kind: 'ad',
  title: 'Разместите свою площадку',
  note: 'Заявки от пар приходят прямо вам — по СМС и на почту',
  href: '/',
  media: `${RL}/gal/g10.webp`,
};

// Каждая пятая публикация — рекламная (условие ТЗ).
export const FEED: FeedItem[] = venues.flatMap((v, i) =>
  (i + 1) % 5 === 0 ? [v, ad] : [v]
);

// Фильтры собираются из самих карточек — руками ничего не дублируем.
const uniq = (list: string[]) => [...new Set(list)];
const toOptions = (values: string[]) => uniq(values).map((v) => ({ value: v, label: v }));

export const VENUE_FILTERS: FilterGroup[] = [
  {
    key: 'type',
    label: 'Тип площадки',
    type: 'multi',
    // Типов немного — все они «популярные»: идут чипами над каталогом
    options: toOptions(venues.map((v) => v.type)).map((o) => ({ ...o, popular: true })),
  },
  {
    key: 'city',
    label: 'Локация',
    type: 'multi',
    options: toOptions(venues.map((v) => v.city)),
  },
  {
    key: 'capacity',
    label: 'Вместимость',
    type: 'single',
    quick: true,
    options: [
      { value: '0-80', label: 'до 80 гостей' },
      { value: '80-120', label: '80–120 гостей' },
      { value: '120+', label: 'более 120 гостей' },
    ],
  },
  {
    key: 'avgCheck',
    label: 'Средний чек',
    type: 'single',
    quick: true,
    options: [
      { value: '0-5', label: 'до 5 000 ₽' },
      { value: '5-7', label: '5 000–7 000 ₽' },
      { value: '7-9', label: '7 000–9 000 ₽' },
      { value: '9+', label: 'от 9 000 ₽' },
    ],
  },
];
