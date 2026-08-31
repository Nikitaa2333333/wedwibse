// ============================================================
// ЛЕНТА ПЛОЩАДОК — раздел 2 основного меню.
// Пока это витрина для дизайна: реальная площадка одна (Ривер Лофт),
// остальные карточки — демонстрационные, чтобы видеть ритм ленты.
// Позже массив заменяется выборкой из базы каталога.
//
// Фильтр и мозаика карточек — тот же паттерн, что у «Специалистов»
// (см. data/specialists.ts, pages/moskva/podryadchiki/vedushchie):
// FilterGroup[] уходит в общий <FilterSidebar>, у карточки — числовые
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
  checkFrom: number;
  avgCheck: string;
  rating: number;
  reviews: number;
  /** фото или видео площадки: листаются вбок */
  media: string[];
  demo?: boolean;
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

const venues: FeedVenue[] = [
  {
    kind: 'venue',
    slug: 'river-loft',
    name: 'Ривер Лофт',
    city: 'Подольск',
    type: 'Лофт',
    capacityMax: 100,
    capacity: 'до 100 гостей',
    checkFrom: 4000,
    avgCheck: 'от 4 000 ₽',
    rating: 4.9,
    reviews: 37,
    media: [`${RL}/gal/g8.webp`, `${RL}/gal/g2.webp`, `${RL}/gal/g5.webp`, `${RL}/welcome/w1.webp`],
  },
  {
    // Рейтинг и число отзывов — с карточки площадки в Яндекс.Картах.
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
    reviews: 277,
    media: [`${FD}/gal/g1.webp`, `${FD}/s2-hall.webp`, `${FD}/gal/g6.webp`, `${FD}/gal/g3.webp`],
  },
  {
    kind: 'venue',
    slug: 'river-loft',
    name: 'Панорама Холл',
    city: 'Москва',
    type: 'Банкетный зал',
    capacityMax: 150,
    capacity: 'до 150 гостей',
    checkFrom: 6500,
    avgCheck: 'от 6 500 ₽',
    rating: 4.8,
    reviews: 52,
    media: [`${RL}/gal/g3.webp`, `${RL}/gal/g9.webp`, `${RL}/gal/g12.webp`],
    demo: true,
  },
  {
    kind: 'venue',
    slug: 'river-loft',
    name: 'Усадьба Дубровицы',
    city: 'Подольск',
    type: 'Усадьба',
    capacityMax: 80,
    capacity: 'до 80 гостей',
    checkFrom: 5200,
    avgCheck: 'от 5 200 ₽',
    rating: 4.7,
    reviews: 24,
    media: [`${RL}/gal/g6.webp`, `${RL}/gal/g14.webp`, `${RL}/welcome/w2.webp`],
    demo: true,
  },
  {
    kind: 'venue',
    slug: 'river-loft',
    name: 'Терраса 21',
    city: 'Москва',
    type: 'Терраса',
    capacityMax: 60,
    capacity: 'до 60 гостей',
    checkFrom: 7000,
    avgCheck: 'от 7 000 ₽',
    rating: 4.6,
    reviews: 18,
    media: [`${RL}/gal/g11.webp`, `${RL}/gal/g4.webp`, `${RL}/gal/g15.webp`],
    demo: true,
  },
  {
    kind: 'venue',
    slug: 'river-loft',
    name: 'Загородный клуб «Пахра»',
    city: 'Московская область',
    type: 'Загородный клуб',
    capacityMax: 200,
    capacity: 'до 200 гостей',
    checkFrom: 5800,
    avgCheck: 'от 5 800 ₽',
    rating: 4.8,
    reviews: 41,
    media: [`${RL}/gal/g7.webp`, `${RL}/gal/g13.webp`, `${RL}/welcome/w3.webp`],
    demo: true,
  },
  {
    kind: 'venue',
    slug: 'river-loft',
    name: 'Белый зал',
    city: 'Москва',
    type: 'Банкетный зал',
    capacityMax: 120,
    capacity: 'до 120 гостей',
    checkFrom: 8000,
    avgCheck: 'от 8 000 ₽',
    rating: 4.9,
    reviews: 63,
    media: [`${RL}/gal/g13.webp`, `${RL}/gal/g1.webp`],
    demo: true,
  },
  {
    kind: 'venue',
    slug: 'river-loft',
    name: 'Лофт 1905',
    city: 'Москва',
    type: 'Лофт',
    capacityMax: 90,
    capacity: 'до 90 гостей',
    checkFrom: 5500,
    avgCheck: 'от 5 500 ₽',
    rating: 4.5,
    reviews: 29,
    media: [`${RL}/gal/g14.webp`, `${RL}/gal/g5.webp`, `${RL}/gal/g10.webp`],
    demo: true,
  },
  {
    kind: 'venue',
    slug: 'river-loft',
    name: 'Панорама 360',
    city: 'Москва',
    type: 'Терраса',
    capacityMax: 70,
    capacity: 'до 70 гостей',
    checkFrom: 9000,
    avgCheck: 'от 9 000 ₽',
    rating: 4.7,
    reviews: 35,
    media: [`${RL}/hero-pt-6.webp`, `${RL}/gal/g9.webp`],
    demo: true,
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
    options: toOptions(venues.map((v) => v.type)),
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
    options: [
      { value: '0-5', label: 'до 5 000 ₽' },
      { value: '5-7', label: '5 000–7 000 ₽' },
      { value: '7-9', label: '7 000–9 000 ₽' },
      { value: '9+', label: 'от 9 000 ₽' },
    ],
  },
];
