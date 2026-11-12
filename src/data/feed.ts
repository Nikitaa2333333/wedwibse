// ============================================================
// ЛЕНТА ПЛОЩАДОК — раздел 2 основного меню.
// Все карточки — реальные площадки каталога (демо-карточки сняты
// 13.09.2026: семи настоящих хватает на ритм ленты, а выдуманные
// мешали бы заливке в базу). Рейтинг и число отзывов — из отзывов невест
// (data/reviews.ts), ставит live-data; с Карт сняты 12.11.2026. Позже массив заменяется
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
  /** нет одобренных отзывов — полей нет, и звезда с нулём на карточке
      не рисуется; ставит live-data из отзывов невест (12.11.2026) */
  rating?: number;
  reviews?: number;
  /** фото или видео площадки: листаются вбок */
  media: string[];
  /** ДЛЯ ФИЛЬТРОВ КАК У WEDWED (12.11.2026, docs/seo/FILTERS-WEDWED.md):
      тип кодом анкеты (restoran, banketnyj-zal, loft, usadba…), округа
      (cao…szao, podmoskovie), особенности (u-vody, svoj-alkogol,
      vyezdnaya-registraciya, za-gorodom). У площадки из базы — колонки
      записи (их ставит хук одобрения из анкеты), у записанных руками — здесь. */
  typeSlug?: string;
  districts?: string[];
  features?: string[];
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
const VB = '/venues/villa-barvikha';
const FP = '/venues/fish-point';
const OTR = '/venues/otrazhenie';
const GRB = '/venues/grebnevo';
const VD = '/venues/villa-dovil';

const venues: FeedVenue[] = [
  {
    kind: 'venue',
    slug: 'river-loft',
    name: 'Ривер Лофт',
    city: 'Подольск',
    type: 'Лофт',
    typeSlug: 'loft',
    districts: ['podmoskovie'],
    features: ['svoj-alkogol', 'vyezdnaya-registraciya', 'za-gorodom'],
    capacityMax: 100,
    capacity: 'до 100 гостей',
    checkFrom: 5000,
    avgCheck: 'от 5 000 ₽',
    media: [`${RL}/gal/g13.webp`, `${RL}/gal/g8.webp`, `${RL}/gal/g2.webp`, `${RL}/gal/g5.webp`],
  },
  {
    kind: 'venue',
    slug: 'forest-dew',
    name: 'Лесная Роса',
    city: 'Подольск',
    type: 'Оранжерея',
    typeSlug: 'oranzhereya',
    districts: ['podmoskovie'],
    features: ['u-vody', 'svoj-alkogol', 'vyezdnaya-registraciya', 'za-gorodom'],
    capacityMax: 70,
    capacity: 'до 70 гостей',
    checkFrom: 9000,
    avgCheck: 'от 9 000 ₽',
    media: [`${FD}/gal/g1.webp`, `${FD}/s2-hall.webp`, `${FD}/gal/g6.webp`, `${FD}/gal/g3.webp`],
  },
  {
    kind: 'venue',
    slug: 'due-to-love',
    name: 'Из-за любви',
    city: 'Подольск',
    type: 'Оранжерея',
    typeSlug: 'oranzhereya',
    districts: ['podmoskovie'],
    features: ['svoj-alkogol', 'vyezdnaya-registraciya', 'za-gorodom'],
    capacityMax: 60,
    capacity: 'до 60 гостей',
    checkFrom: 9000,
    avgCheck: 'от 9 000 ₽',
    media: [`${DTL}/p58.webp`, `${DTL}/p14.webp`, `${DTL}/p28.webp`, `${DTL}/p74.webp`],
  },
  {
    kind: 'venue',
    slug: 'spark-hall',
    name: 'Spark Hall',
    city: 'Красногорск',
    type: 'Банкетный зал',
    typeSlug: 'banketnyj-zal',
    districts: ['podmoskovie'],
    features: ['vyezdnaya-registraciya', 'za-gorodom'],
    capacityMax: 120,
    capacity: 'до 120 гостей',
    avgCheck: 'цена по запросу',
    media: [`${SPARK}/hero-main.webp`, `${SPARK}/gal/g1.webp`, `${SPARK}/gal/g2.webp`, `${SPARK}/gal/g3.webp`],
  },
  {
    kind: 'venue',
    slug: 'led',
    name: 'LЁD',
    city: 'Красногорск',
    type: 'Оранжерея',
    typeSlug: 'oranzhereya',
    districts: ['podmoskovie'],
    features: ['vyezdnaya-registraciya', 'za-gorodom'],
    capacityMax: 60,
    capacity: 'до 60 гостей',
    avgCheck: 'цена по запросу',
    media: [`${LED}/hero-main.webp`, `${LED}/gal/g1.webp`, `${LED}/gal/g2.webp`, `${LED}/gal/g3.webp`],
  },
  {
    kind: 'venue',
    slug: 'fish-point',
    name: 'Fish Point',
    city: 'Подольск',
    type: 'Банкетный зал',
    typeSlug: 'banketnyj-zal',
    districts: ['podmoskovie'],
    features: ['svoj-alkogol', 'vyezdnaya-registraciya', 'za-gorodom'],
    capacityMax: 200,
    capacity: 'до 200 гостей',
    avgCheck: 'депозитная система',
    media: [`${FP}/p40.webp`, `${FP}/p03.webp`, `${FP}/p21.webp`, `${FP}/p35.webp`],
  },
  {
    kind: 'venue',
    slug: 'otrazhenie',
    name: 'Отражение',
    city: 'Можайский район',
    type: 'Оранжерея',
    typeSlug: 'oranzhereya',
    districts: ['podmoskovie'],
    features: ['u-vody', 'svoj-alkogol', 'vyezdnaya-registraciya', 'za-gorodom'],
    capacityMax: 60,
    capacity: 'до 60 гостей',
    checkFrom: 9000,
    avgCheck: 'от 9 000 ₽',
    media: [`${OTR}/p56.webp`, `${OTR}/p31.webp`, `${OTR}/p12.webp`, `${OTR}/p21.webp`],
  },
  {
    // Усадьба с девятью залами — в каталоге одна карточка; вместимость
    // и чек — по самому большому залу и общему минимуму меню.
    kind: 'venue',
    slug: 'grebnevo',
    name: 'Усадьба Гребнево',
    city: 'Щёлково',
    type: 'Усадьба',
    typeSlug: 'usadba',
    districts: ['podmoskovie'],
    features: ['u-vody', 'svoj-alkogol', 'vyezdnaya-registraciya', 'za-gorodom'],
    capacityMax: 350,
    capacity: '9 залов · до 350 гостей',
    checkFrom: 7000,
    avgCheck: 'от 7 000 ₽',
    media: [`${GRB}/grand-lesnoy/p10.webp`, `${GRB}/barsky/p04.webp`, `${GRB}/pushkin/p13.webp`, `${GRB}/trubetskoy-hall/p13.webp`],
  },
  {
    kind: 'venue',
    slug: 'villa-barvikha',
    name: 'Villa Barvikha 135',
    city: 'Барвиха',
    type: 'Усадьба',
    typeSlug: 'usadba',
    districts: ['podmoskovie'],
    features: ['svoj-alkogol', 'vyezdnaya-registraciya', 'za-gorodom'],
    capacityMax: 450,
    capacity: 'до 450 гостей',
    checkFrom: 8500,
    avgCheck: 'от 8 500 ₽',
    media: [`${VB}/p21.webp`, `${VB}/p37.webp`, `${VB}/p01.webp`, `${VB}/p16.webp`],
  },
  {
    kind: 'venue',
    slug: 'villa-dovil',
    name: 'Вилла Довиль',
    city: 'Одинцово',
    type: 'Веранда',
    typeSlug: 'veranda',
    districts: ['podmoskovie'],
    features: ['u-vody', 'vyezdnaya-registraciya', 'za-gorodom'],
    capacityMax: 300,
    capacity: 'до 300 гостей',
    checkFrom: 12000,
    avgCheck: 'от 12 000 ₽',
    media: [`${VD}/p03.webp`, `${VD}/p01.webp`, `${VD}/p02.webp`, `${VD}/p09.webp`],
  },
];

const ad: FeedAd = {
  kind: 'ad',
  title: 'Разместите свою площадку',
  note: 'Заявки от пар приходят прямо вам — по СМС и на почту',
  href: '/',
  media: `${RL}/gal/g10.webp`,
};

// Рекламная карточка в ленте ВЫКЛЮЧЕНА (13.09.2026, по просьбе
// пользователя): при семи площадках чёрная плашка «Разместите свою
// площадку» перебивала каталог. Условие ТЗ «каждая пятая публикация —
// реклама» остаётся на будущее: вернуть — заменить строку ниже на
// venues.flatMap((v, i) => ((i + 1) % 5 === 0 ? [v, ad] : [v])).
// Разметка и стили .vcard--ad в pages/moskva/ploshchadki/index.astro на месте.
void ad;
export const FEED: FeedItem[] = [...venues];
/** карточки каталога, записанные руками (по slug) — основа для площадок из базы */
export const STATIC_FEED: readonly FeedVenue[] = venues;

// ============ ФИЛЬТРЫ КАК У WEDWED (Никита 12.11.2026) ============
// Набор и порядок — с wedwed.ru/catalog/ploschadki/ (docs/seo/FILTERS-WEDWED.md):
// тип, средний чек, вместимость, расположение, особенности; везде можно
// выбрать несколько (внутри группы — ИЛИ, между группами — И). «Назначение»
// не выводим: каталог только про свадьбы. Тип «Оранжерея» добавлен к восьми
// типам wedwed — у нас таких площадок много, без него их не отобрать.
// Значения карточки считает страница каталога (filtersOf), корзины — здесь.
const NB = '\u00a0';

export const VENUE_TYPE_FILTER: Record<string, string> = {
  restoran: 'restoran-banketnyj-zal',
  'banketnyj-zal': 'restoran-banketnyj-zal',
  shater: 'shater',
  veranda: 'veranda',
  'restoran-pri-otele': 'restoran-pri-otele',
  'zagorodnyj-klub': 'zagorodnyj-klub',
  loft: 'loft',
  'yaht-klub': 'yaht-klub',
  usadba: 'usadba',
  oranzhereya: 'oranzhereya',
};

/** корзины чека на гостя, ₽: [значение, от, до] */
export const CHECK_BUCKETS: [string, number, number][] = [
  ['2-4', 2000, 4000],
  ['4-6', 4000, 6000],
  ['6-8', 6000, 8000],
  ['8-15', 8000, 15000],
];

/** корзины вместимости, гостей: [значение, от, до] — как у wedwed */
export const CAPACITY_BUCKETS: [string, number, number][] = [
  ['0-19', 0, 19],
  ['20-29', 20, 29],
  ['30-39', 30, 39],
  ['40-49', 40, 49],
  ['50-79', 50, 79],
  ['80-120', 80, 120],
  ['121-450', 121, 450],
];

const rub = (n: number) => n.toLocaleString('ru-RU').replace(/\s/g, NB);

export const VENUE_FILTERS: FilterGroup[] = [
  {
    key: 'type',
    label: 'Тип площадки',
    type: 'multi',
    options: [
      { value: 'restoran-banketnyj-zal', label: 'Ресторан, банкетный зал', popular: 'Ресторан' },
      { value: 'shater', label: 'Шатёр', popular: true },
      { value: 'veranda', label: 'Веранда', popular: true },
      { value: 'restoran-pri-otele', label: 'Ресторан при отеле' },
      { value: 'zagorodnyj-klub', label: 'Загородный клуб' },
      { value: 'loft', label: 'Лофт', popular: true },
      { value: 'yaht-klub', label: 'Яхт-клуб' },
      { value: 'usadba', label: 'Усадьба, особняк', popular: 'Усадьба' },
      { value: 'oranzhereya', label: 'Оранжерея', popular: true },
    ],
  },
  {
    key: 'avgCheck',
    label: 'Средний чек на гостя',
    type: 'multi',
    quick: true,
    options: CHECK_BUCKETS.map(([value, from, to]) => ({ value, label: `${rub(from)}–${rub(to)}${NB}₽` })),
  },
  {
    key: 'capacity',
    label: 'Вместимость',
    type: 'multi',
    quick: true,
    options: CAPACITY_BUCKETS.map(([value, from, to]) => ({ value, label: from === 0 ? `до${NB}${to} гостей` : `${from}–${to} гостей` })),
  },
  {
    key: 'district',
    label: 'Расположение',
    type: 'multi',
    options: [
      { value: 'vao', label: 'ВАО' },
      { value: 'zao', label: 'ЗАО' },
      { value: 'sao', label: 'САО' },
      { value: 'svao', label: 'СВАО' },
      { value: 'szao', label: 'СЗАО' },
      { value: 'cao', label: 'ЦАО' },
      { value: 'yuao', label: 'ЮАО' },
      { value: 'yuvao', label: 'ЮВАО' },
      { value: 'yuzao', label: 'ЮЗАО' },
      { value: 'podmoskovie', label: 'Подмосковье' },
    ],
  },
  {
    key: 'features',
    label: 'Особенности',
    type: 'multi',
    options: [
      { value: 'u-vody', label: 'У воды', popular: true },
      { value: 'svoj-alkogol', label: 'Можно свой алкоголь', popular: 'Свой алкоголь' },
      { value: 'vyezdnaya-registraciya', label: 'С выездной регистрацией', popular: 'Выездная регистрация' },
      { value: 'za-gorodom', label: 'За городом' },
    ],
  },
  {
    // Локация шапки (ScopePicker, общая для всех каталогов): Москва или область.
    // В шторке не показывается — её ведёт чип в шапке; значение карточки —
    // по округам (podmoskovie → область).
    key: 'city',
    label: 'Локация',
    type: 'single',
    hidden: true,
    options: [
      { value: 'Москва', label: 'Москва' },
      { value: 'Московская область', label: 'Московская область' },
    ],
  },
];

/** САЙТ ИЗ БАЗЫ (этап 3, 05.11.2026): лента каталога из площадок базы —
 *  подставляется на место. Набор фильтров постоянный (как у wedwed), из
 *  ленты больше не пересчитывается. */
export function applyLiveFeed(items: FeedVenue[]) {
  FEED.length = 0;
  FEED.push(...items);
}
