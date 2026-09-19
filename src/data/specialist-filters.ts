// ============================================================
// ФИЛЬТРЫ КАТЕГОРИЙ ПОДРЯДЧИКОВ — по документам заказчика
// «Основные фильтры для <категории>» (19.09.2026, research/filters/all.md).
// Ведущие, фотографы и декораторы заведены раньше и живут в specialists.ts
// (их наборы совпадают с документами); здесь — остальные, плюс видеографы,
// у которых с этого дня свой набор, а не копия фотографов.
//
// Это же — источник столбцов реестра каталога (Google-таблица модератора):
// scripts/filters-dump.mjs выгружает наборы в JSON, из него строятся вкладки.
// Новый фильтр = здесь, и только здесь; вручную столбец в таблицу не заводим.
//
// Значения (value) — латиница, они уходят в data-filters карточек и в базу;
// подписи (label) — то, что видит человек в шторке и в таблице.
// ============================================================
import type { FilterGroup, FilterOption } from './specialists';

type Pair = [value: string, label: string];

const opts = (pairs: Pair[]): FilterOption[] => pairs.map(([value, label]) => ({ value, label }));
const single = (key: string, label: string, pairs: Pair[], quick = false): FilterGroup => ({
  key, label, type: 'single', options: opts(pairs), ...(quick ? { quick } : {}),
});
const multi = (key: string, label: string, pairs: Pair[], quick = false): FilterGroup => ({
  key, label, type: 'multi', options: opts(pairs), ...(quick ? { quick } : {}),
});
const yesNo = (key: string, label: string, popular?: string): FilterGroup => ({
  key, label, type: 'single',
  options: [{ value: 'yes', label: 'Да', ...(popular ? { popular } : {}) }, { value: 'no', label: 'Нет' }],
});

// ---------- общие для всех блоки ----------
/** «Город/регион + выезд» — округа Москвы, область, выезд за область */
const CITY = multi('city', 'Город и выезд', [
  ['цао', 'ЦАО'], ['сао', 'САО'], ['свао', 'СВАО'], ['вао', 'ВАО'], ['юво', 'ЮВАО'],
  ['юао', 'ЮАО'], ['юзао', 'ЮЗАО'], ['зао', 'ЗАО'], ['сзао', 'СЗАО'],
  ['mo', 'Московская область'], ['вне-мо', 'Готов выехать за МО'],
]);
const GENDER = single('gender', 'Кто снимает', [['м', 'Мужчина'], ['ж', 'Женщина'], ['pair', 'Пара, фото и видео']]);
const EXPERIENCE = single('experience', 'Опыт работы', [['0-5', 'менее 5 лет'], ['5-10', '5–10 лет'], ['15+', 'более 15 лет']]);
const PREPAYMENT = single('prepayment', 'Предоплата', [['0-20', 'до 20%'], ['20-50', '20–50%'], ['50-100', '50–100%']]);
const CONTRACT = yesNo('contract', 'Договор', 'С договором');
const LEAD_TIME_SHORT = single('leadTime', 'Сроки подготовки', [['1-2d', '1–2 дня'], ['3-7d', '3–7 дней'], ['7d+', 'более 7 дней']]);

const money = (pairs: Pair[]) => pairs;

// ============ ФИЛЬТРЫ: ВЕДУЩИЕ ============
export const VEDUSHCHIE_FILTERS: FilterGroup[] = [
  {
    key: 'gender',
    label: 'Пол',
    type: 'single',
    options: [
      { value: 'м', label: 'Мужской' },
      { value: 'ж', label: 'Женский' },
    ],
  },
  {
    key: 'price',
    label: 'Цена за 6 часов работы',
    type: 'single',
    quick: true,
    options: [
      { value: '0-60', label: 'до 60 тыс. ₽' },
      { value: '60-100', label: '60–100 тыс. ₽' },
      { value: '100-150', label: '100–150 тыс. ₽' },
      { value: '150-200', label: '150–200 тыс. ₽' },
      { value: '200+', label: 'более 200 тыс. ₽' },
    ],
  },
  {
    key: 'city',
    label: 'Город и выезд',
    type: 'multi',
    options: [
      { value: 'цао', label: 'ЦАО' },
      { value: 'сао', label: 'САО' },
      { value: 'свао', label: 'СВАО' },
      { value: 'вао', label: 'ВАО' },
      { value: 'юво', label: 'ЮВАО' },
      { value: 'юао', label: 'ЮАО' },
      { value: 'юзао', label: 'ЮЗАО' },
      { value: 'зао', label: 'ЗАО' },
      { value: 'сзао', label: 'СЗАО' },
      { value: 'mo', label: 'Московская область' },
      { value: 'вне-мо', label: 'Готов выехать за МО' },
    ],
  },
  {
    key: 'style',
    label: 'Стиль ведения',
    type: 'multi',
    quick: true,
    options: [
      { value: 'classic', label: 'Классический' },
      { value: 'modern', label: 'Современный' },
      { value: 'interactive', label: 'Интерактивный' },
      { value: 'humor', label: 'Юмористический', popular: true },
      { value: 'intelligent', label: 'Интеллигентный' },
      { value: 'show', label: 'С элементами шоу' },
      { value: 'no-vulgar', label: 'Без пошлости', popular: true },
      { value: 'bilingual', label: 'На двух языках' },
    ],
  },
  {
    key: 'age',
    label: 'Возраст',
    type: 'single',
    options: [
      { value: 'до 25', label: 'менее 25 лет' },
      { value: '25–35', label: '25–35 лет' },
      { value: '35–50', label: '35–50 лет' },
      { value: '50+', label: '50+ лет' },
    ],
  },
  {
    key: 'experience',
    label: 'Опыт работы',
    type: 'single',
    options: [
      { value: '0-5', label: 'менее 5 лет' },
      { value: '5-10', label: '5–10 лет' },
      { value: '15+', label: 'более 15 лет' },
    ],
  },
  {
    key: 'ownDJ',
    label: 'Есть свой диджей',
    type: 'single',
    options: [
      { value: 'yes', label: 'Да', popular: 'Свой диджей' },
      { value: 'no', label: 'Нет' },
    ],
  },
  {
    key: 'formats',
    label: 'Форматы свадеб',
    type: 'multi',
    options: [
      { value: 'intimate', label: 'Камерные (до 30 гостей)' },
      { value: 'medium', label: 'Средние (30–80)' },
      { value: 'large', label: 'Масштабные (80+)' },
      { value: 'ceremony', label: 'Выездные церемонии' },
      { value: 'gender-party', label: 'Гендер-пати' },
      { value: 'anniversary', label: 'Юбилеи' },
      { value: 'engagement', label: 'Помолвки' },
    ],
  },
  {
    key: 'languages',
    label: 'Языки ведения',
    type: 'multi',
    options: [
      { value: 'ru', label: 'Русский' },
      { value: 'en', label: 'Английский' },
      { value: 'other', label: 'Другие' },
    ],
  },
  {
    key: 'ceremonyMaster',
    label: 'Ведёт выездную церемонию',
    type: 'single',
    options: [
      { value: 'yes', label: 'Да', popular: 'Выездная церемония' },
      { value: 'no', label: 'Нет' },
    ],
  },
  {
    key: 'equipment',
    label: 'Своё оборудование и микрофоны',
    type: 'single',
    options: [
      { value: 'yes', label: 'Да', popular: 'Своё оборудование' },
      { value: 'no', label: 'Нет' },
    ],
  },
];

// ============ ФИЛЬТРЫ: ФОТОГРАФЫ ============
export const FOTOGRAFY_FILTERS: FilterGroup[] = [
  {
    key: 'gender',
    label: 'Кто снимает',
    type: 'single',
    options: [
      { value: 'м', label: 'Мужчина' },
      { value: 'ж', label: 'Женщина' },
      // Пара со съёмкой «фото + видео» — распространённый формат, и в
      // «мужской/женский» он не укладывается
      { value: 'pair', label: 'Пара, фото и видео', popular: 'Фото и видео вместе' },
    ],
  },
  {
    key: 'priceHour',
    label: 'Цена за 1 час работы',
    type: 'single',
    options: [
      { value: '4-5', label: '4–5 тыс. ₽' },
      { value: '5-6', label: '5–6 тыс. ₽' },
      { value: '6-8', label: '6–8 тыс. ₽' },
      { value: '8-10', label: '8–10 тыс. ₽' },
      { value: '10+', label: 'более 10 тыс. ₽' },
    ],
  },
  {
    key: 'city',
    label: 'Город и выезд',
    type: 'multi',
    options: [
      { value: 'цао', label: 'ЦАО' },
      { value: 'сао', label: 'САО' },
      { value: 'свао', label: 'СВАО' },
      { value: 'вао', label: 'ВАО' },
      { value: 'юво', label: 'ЮВАО' },
      { value: 'юао', label: 'ЮАО' },
      { value: 'юзао', label: 'ЮЗАО' },
      { value: 'зао', label: 'ЗАО' },
      { value: 'сзао', label: 'СЗАО' },
      { value: 'mo', label: 'Московская область' },
      { value: 'вне-мо', label: 'Готов выехать за МО' },
    ],
  },
  {
    key: 'experience',
    label: 'Опыт работы',
    type: 'single',
    options: [
      { value: '0-5', label: 'менее 5 лет' },
      { value: '5-10', label: '5–10 лет' },
      { value: '15+', label: 'более 15 лет' },
    ],
  },
  {
    key: 'style',
    label: 'Стиль съёмки',
    type: 'multi',
    options: [
      { value: 'reportage', label: 'Репортаж' },
      { value: 'classic', label: 'Классика' },
      { value: 'minimal', label: 'Минимализм' },
      { value: 'bw', label: 'Чёрно-белый' },
      { value: 'artistic', label: 'Художественный' },
      { value: 'staged', label: 'Постановочный' },
      { value: 'lifestyle', label: 'Лайфстайл' },
    ],
  },
  {
    key: 'serviceType',
    label: 'Тип услуги',
    type: 'multi',
    options: [
      { value: 'full-day', label: 'Полный день' },
      { value: 'partial', label: 'Частичная съёмка' },
      { value: 'love-story', label: 'Лав-стори' },
      { value: 'express', label: 'Экспресс' },
    ],
  },
  {
    key: 'minBudget',
    label: 'Минимальный бюджет',
    type: 'single',
    options: [
      { value: '0-30', label: 'до 30 тыс. ₽' },
      { value: '30-60', label: '30–60 тыс. ₽' },
      { value: '60-100', label: '60–100 тыс. ₽' },
      { value: '100-150', label: '100–150 тыс. ₽' },
      { value: '150+', label: 'более 150 тыс. ₽' },
    ],
  },
  {
    key: 'secondPhotographer',
    label: 'Есть второй фотограф',
    type: 'single',
    options: [
      { value: 'yes', label: 'Да' },
      { value: 'no', label: 'Нет' },
    ],
  },
  {
    key: 'deliveryTime',
    label: 'Сроки выдачи фото',
    type: 'single',
    options: [
      { value: '1-2w', label: '1–2 недели' },
      { value: '2-4w', label: '2–4 недели' },
      { value: '1-3m', label: '1–3 месяца' },
      { value: '3-6m', label: '3–6 месяцев' },
      { value: '6m+', label: 'более 6 месяцев' },
    ],
  },
  {
    key: 'deliveryFormat',
    label: 'Формат выдачи',
    type: 'multi',
    options: [
      { value: 'gallery', label: 'Онлайн-галерея' },
      { value: 'usb', label: 'Флешка' },
      { value: 'photobook', label: 'Фотокнига' },
    ],
  },
  {
    key: 'contract',
    label: 'Договор',
    type: 'single',
    options: [
      { value: 'yes', label: 'Да' },
      { value: 'no', label: 'Нет' },
    ],
  },
  {
    key: 'prepayment',
    label: 'Предоплата',
    type: 'single',
    options: [
      { value: '0-20', label: 'до 20%' },
      { value: '20-50', label: '20–50%' },
      { value: '50-100', label: '50–100%' },
    ],
  },
];

// ============ ФИЛЬТРЫ: ДЕКОРАТОРЫ ============
export const DEKORATORY_FILTERS: FilterGroup[] = [
  {
    key: 'city',
    label: 'Город/регион',
    type: 'multi',
    options: [
      { value: 'moskva', label: 'Москва' },
      { value: 'mo', label: 'Московская область' },
      { value: 'other', label: 'Другой регион' },
    ],
  },
  {
    key: 'travel',
    label: 'Выезд за пределы города',
    type: 'single',
    options: [
      { value: 'yes', label: 'Да' },
      { value: 'no', label: 'Нет' },
    ],
  },
  {
    key: 'priceTier',
    label: 'Ценовой сегмент',
    type: 'single',
    options: [
      { value: 'budget', label: 'Бюджетный' },
      { value: 'medium', label: 'Средний' },
      { value: 'premium', label: 'Премиум' },
    ],
  },
  {
    key: 'style',
    label: 'Стили',
    type: 'multi',
    options: [
      { value: 'classic', label: 'Классика' },
      { value: 'loft', label: 'Лофт' },
      { value: 'rustic', label: 'Рустик' },
      { value: 'boho', label: 'Бохо' },
      { value: 'minimal', label: 'Минимализм' },
      { value: 'glam', label: 'Гламур' },
      { value: 'eco', label: 'Эко' },
      { value: 'oriental', label: 'Восточный' },
    ],
  },
  {
    key: 'liveFlorals',
    label: 'Работа с живой флористикой',
    type: 'single',
    options: [
      { value: 'yes', label: 'Да' },
      { value: 'no', label: 'Нет' },
    ],
  },
  {
    key: 'fabrics',
    label: 'Работа с тканями',
    type: 'single',
    options: [
      { value: 'yes', label: 'Да' },
      { value: 'no', label: 'Нет' },
    ],
  },
  {
    key: 'riggingWork',
    label: 'Сложные монтажи / верховые работы',
    type: 'single',
    options: [
      { value: 'yes', label: 'Да' },
      { value: 'no', label: 'Нет' },
    ],
  },
  {
    key: 'serviceType',
    label: 'Тип услуги',
    type: 'multi',
    options: [
      { value: 'turnkey', label: 'Под ключ' },
      { value: 'separate', label: 'Отдельные услуги' },
      { value: 'rental', label: 'Аренда' },
    ],
  },
  {
    key: 'minBudget',
    label: 'Минимальный бюджет',
    type: 'single',
    options: [
      { value: '0-50', label: 'до 50 тыс. ₽' },
      { value: '50-100', label: '50–100 тыс. ₽' },
      { value: '100-200', label: '100–200 тыс. ₽' },
      { value: '200+', label: 'более 200 тыс. ₽' },
    ],
  },
  {
    key: 'venueTypes',
    label: 'Типы площадок',
    type: 'multi',
    options: [
      { value: 'loft', label: 'Лофт' },
      { value: 'hall', label: 'Банкетный зал' },
      { value: 'estate', label: 'Усадьба' },
      { value: 'terrace', label: 'Терраса' },
      { value: 'country-club', label: 'Загородный клуб' },
    ],
  },
  {
    key: 'nonStandardVenues',
    label: 'Готовность к нестандартным площадкам',
    type: 'single',
    options: [
      { value: 'yes', label: 'Да' },
      { value: 'no', label: 'Нет' },
    ],
  },
  {
    key: 'prepayment',
    label: 'Предоплата',
    type: 'single',
    options: [
      { value: '0-20', label: 'до 20%' },
      { value: '20-50', label: '20–50%' },
      { value: '50-100', label: '50–100%' },
    ],
  },
  {
    key: 'contract',
    label: 'Договор',
    type: 'single',
    options: [
      { value: 'yes', label: 'Да' },
      { value: 'no', label: 'Нет' },
    ],
  },
];

// ---------- организаторы ----------
export const ORGANIZATORY_FILTERS: FilterGroup[] = [
  CITY,
  multi('format', 'Формат', [
    ['turnkey', 'Под ключ'], ['partial', 'Частичное сопровождение'], ['coordination', 'Только координация'],
    ['express', 'Экспресс-свадьба'], ['abroad', 'За рубежом'],
  ], true),
  multi('niche', 'Ниша', [['luxury', 'Люкс'], ['budget', 'Бюджет'], ['multicultural', 'Мультикультурные'], ['eco', 'Эко'], ['themed', 'Тематические']]),
  single('minBudget', 'Минимальный бюджет проекта', money([
    ['0-300', 'до 300 тыс. ₽'], ['300-500', '300–500 тыс. ₽'], ['500-1000', '500 тыс. – 1 млн ₽'], ['1000-3000', '1–3 млн ₽'], ['3000+', 'более 3 млн ₽'],
  ]), true),
  single('coordinators', 'Координаторов в день свадьбы', [['1', 'Один'], ['2+', 'Два и больше']]),
  single('leadTime', 'Срок подготовки', [['2-4w', '2–4 недели'], ['2-6m', '2–6 месяцев'], ['6-12m', '6–12 месяцев'], ['12m+', 'более года']]),
  PREPAYMENT, CONTRACT,
];

// ---------- координаторы ----------
export const KOORDINATORY_FILTERS: FilterGroup[] = [
  CITY,
  single('price', 'Цена', money([
    ['0-10', 'до 10 тыс. ₽'], ['10-15', '10–15 тыс. ₽'], ['15-20', '15–20 тыс. ₽'], ['20-30', '20–30 тыс. ₽'], ['30+', 'более 30 тыс. ₽'],
  ]), true),
  multi('format', 'Формат', [['day', 'Только день свадьбы'], ['prep', 'Предподготовка'], ['full', 'Полный цикл'], ['express', 'Экспресс'], ['vip', 'VIP']], true),
  multi('weddingType', 'Тип свадьбы', [
    ['intimate', 'Камерная'], ['medium', 'Средняя'], ['large', 'Масштабная'], ['outdoor', 'Выездная'], ['themed', 'Тематическая'], ['multicultural', 'Мультикультурная'],
  ]),
  single('minTime', 'Минимальное время', [['0-1h', 'до 1 часа'], ['1-3h', '1–3 часа'], ['3-6h', '3–6 часов'], ['6-12h', '6–12 часов'], ['12h+', 'более 12 часов']]),
  multi('control', 'Зона контроля', [
    ['timing', 'Тайминг'], ['vendors', 'Подрядчики'], ['venue', 'Площадка'], ['decor', 'Декор'], ['catering', 'Кейтеринг'], ['photo-video', 'Фото и видео'], ['guests', 'Гости'],
  ]),
  single('leadTime', 'Сроки подготовки', [['1-3d', '1–3 дня'], ['7-14d', '7–14 дней'], ['14d+', 'более 14 дней']]),
  PREPAYMENT, CONTRACT,
];

// ---------- видеографы ----------
export const VIDEOGRAFY_FILTERS: FilterGroup[] = [
  GENDER,
  single('priceHour', 'Цена за 1 час работы', money([
    ['4-5', '4–5 тыс. ₽'], ['5-6', '5–6 тыс. ₽'], ['6-8', '6–8 тыс. ₽'], ['8-10', '8–10 тыс. ₽'], ['10-15', '10–15 тыс. ₽'], ['15+', 'более 15 тыс. ₽'],
  ]), true),
  CITY,
  multi('style', 'Стиль видео', [['reportage', 'Репортаж'], ['cinematic', 'Кинематографичный'], ['dynamic', 'Динамичный'], ['minimal', 'Минимализм']], true),
  EXPERIENCE,
  multi('serviceType', 'Тип услуги', [
    ['full-day', 'Полный день'], ['partial', 'Частичная съёмка'], ['love-story', 'Лав-стори'], ['express', 'Экспресс'], ['teaser-film', 'Пакет «тизер + фильм»'],
  ]),
  single('minBudget', 'Минимальный бюджет', money([
    ['0-30', 'до 30 тыс. ₽'], ['30-60', '30–60 тыс. ₽'], ['60-100', '60–100 тыс. ₽'], ['100-150', '100–150 тыс. ₽'], ['150+', 'более 150 тыс. ₽'],
  ])),
  single('operators', 'Операторов', [['1', 'Один'], ['2+', 'Два и больше']]),
  yesNo('drone', 'Съёмка с дрона', 'С дроном'),
  single('filmLength', 'Хронометраж фильма', [['0-30', 'до 30 минут'], ['30-60', '30–60 минут'], ['60+', 'более часа']]),
  single('deliveryTime', 'Сроки выдачи видео', [['0-2w', 'до 2 недель'], ['2-4w', '2–4 недели'], ['1-3m', '1–3 месяца'], ['3-6m', '3–6 месяцев'], ['6m+', 'более 6 месяцев']]),
  multi('deliveryFormat', 'Формат выдачи', [['gallery', 'Онлайн-галерея'], ['usb', 'Флешка'], ['cloud', 'Облако']]),
  CONTRACT, PREPAYMENT,
];

// ---------- reels-мейкеры ----------
export const RILS_FILTERS: FilterGroup[] = [
  CITY,
  multi('format', 'Формат', [['shoot', 'Съёмка'], ['edit', 'Монтаж'], ['turnkey', 'Под ключ'], ['series', 'Серия публикаций']], true),
  multi('theme', 'Тематика', [['couple', 'Пара'], ['guests', 'Гости'], ['backstage', 'Бэкстейдж'], ['first-dance', 'Первый танец'], ['emotions', 'Эмоции'], ['venue-vendors', 'Площадка и подрядчики']]),
  single('minBudget', 'Минимальный бюджет', money([
    ['0-5', 'до 5 тыс. ₽'], ['5-10', '5–10 тыс. ₽'], ['10-20', '10–20 тыс. ₽'], ['20-30', '20–30 тыс. ₽'], ['30+', 'более 30 тыс. ₽'],
  ]), true),
  single('minTime', 'Минимальное время', [['30-60m', '30–60 минут'], ['1-3h', '1–3 часа'], ['3-6h', '3–6 часов'], ['6-12h', '6–12 часов'], ['12h+', 'более 12 часов']]),
  single('deliveryTime', 'Сроки выдачи', [['0-24h', 'до 24 часов'], ['48-72h', '48–72 часа'], ['72h+', 'более 72 часов']]),
  multi('equipment', 'Оборудование', [['camera', 'Камера'], ['gimbal', 'Стабилизатор'], ['light', 'Свет'], ['mic', 'Микрофон']]),
  multi('music', 'Музыка и тренды', [['trending', 'Подбор трендовых звуков'], ['references', 'Работа по референсам'], ['libraries', 'Библиотеки музыки']]),
  yesNo('subtitles', 'Субтитры и текст'),
  single('portfolioRights', 'Использование в портфолио', [['no-faces', 'Без лиц'], ['backstage', 'Только бэкстейдж'], ['none', 'Не публикует']]),
  PREPAYMENT, CONTRACT,
];

// ---------- кейтеринг ----------
export const KEITERING_FILTERS: FilterGroup[] = [
  CITY,
  single('pricePerson', 'Цена за гостя', money([
    ['0-5', 'до 5 тыс. ₽'], ['5-8', '5–8 тыс. ₽'], ['8-10', '8–10 тыс. ₽'], ['10+', 'более 10 тыс. ₽'],
  ]), true),
  multi('format', 'Формат', [['buffet', 'Фуршет'], ['banquet', 'Банкет'], ['cocktail', 'Коктейль'], ['brunch', 'Бранч'], ['candy-bar', 'Кэнди-бар'], ['station', 'Выездная станция']], true),
  multi('cuisine', 'Кухня', [
    ['european', 'Европейская'], ['russian', 'Русская'], ['caucasian', 'Кавказская'], ['asian', 'Азиатская'], ['korean', 'Корейская'], ['jewish', 'Еврейская'],
    ['turkish', 'Турецкая'], ['vegetarian', 'Вегетарианская'], ['vegan', 'Веган'], ['halal', 'Халяль'], ['gluten-free', 'Без глютена'], ['exotic', 'Экзотическая'],
  ]),
  single('minBudget', 'Минимальный бюджет', money([
    ['0-100', 'до 100 тыс. ₽'], ['100-200', '100–200 тыс. ₽'], ['200-300', '200–300 тыс. ₽'], ['300-500', '300–500 тыс. ₽'], ['500-1000', '500 тыс. – 1 млн ₽'], ['1000+', 'более 1 млн ₽'],
  ])),
  single('minGuests', 'Минимум гостей', [['0-20', 'до 20'], ['20-30', '20–30'], ['30-50', '30–50'], ['50-70', '50–70'], ['70-100', '70–100'], ['100+', 'более 100']]),
  multi('staff', 'Персонал', [['cooks', 'Повара'], ['grill', 'Мангальщики'], ['sushi', 'Сушисты'], ['waiters', 'Официанты'], ['bartender', 'Бармен'], ['sommelier', 'Сомелье'], ['chef', 'Шеф на площадке']]),
  multi('rental', 'Аренда', [['tableware', 'Посуда'], ['textile', 'Текстиль'], ['furniture', 'Мебель'], ['tents', 'Шатры'], ['light', 'Свет'], ['heating', 'Обогрев']]),
  multi('options', 'Особые опции', [['tasting', 'Дегустация'], ['author-menu', 'Авторское меню'], ['seasonal', 'Сезонные продукты'], ['eco-pack', 'Эко-упаковка']]),
  single('leadTime', 'Сроки подготовки', [['24-48h', 'Экспресс 24–48 часов'], ['3-7d', 'Стандарт 3–7 дней'], ['7d+', 'более 7 дней']]),
  PREPAYMENT, CONTRACT,
];

// ---------- кондитеры ----------
export const KONDITERY_FILTERS: FilterGroup[] = [
  CITY,
  yesNo('delivery', 'Доставка', 'С доставкой'),
  single('priceKg', 'Цена за килограмм', money([
    ['0-3', 'до 3 тыс. ₽'], ['3-4', '3–4 тыс. ₽'], ['4-6', '4–6 тыс. ₽'], ['6-8', '6–8 тыс. ₽'], ['8+', 'более 8 тыс. ₽'],
  ]), true),
  multi('productType', 'Тип изделия', [
    ['wedding-cake', 'Свадебный торт'], ['mini-desserts', 'Мини-десерты'], ['cupcakes', 'Капкейки'], ['mousse', 'Муссовые'], ['vegan', 'Веган'], ['gluten-free', 'Без глютена'],
  ], true),
  multi('style', 'Стиль оформления', [['minimal', 'Минимализм'], ['classic', 'Классика'], ['boho', 'Бохо'], ['rustic', 'Рустик'], ['naked', '«Голый» торт']]),
  single('minWeight', 'Минимальный вес', [['0-1', 'до 1 кг'], ['1-2', '1–2 кг'], ['2-3', '2–3 кг'], ['3-5', '3–5 кг'], ['5+', 'более 5 кг']]),
  single('minOrder', 'Минимальный заказ', money([['0-2', 'до 2 тыс. ₽'], ['2-3', '2–3 тыс. ₽'], ['3-5', '3–5 тыс. ₽'], ['5-10', '5–10 тыс. ₽'], ['10+', 'более 10 тыс. ₽']])),
  single('leadTime', 'Сроки изготовления', [['0-3d', 'Экспресс до 3 дней'], ['3-7d', '3–7 дней'], ['7d+', 'более 7 дней']]),
  multi('options', 'Особые опции', [
    ['fresh-flowers', 'Живые цветы'], ['custom-pack', 'Индивидуальная упаковка'], ['tasting', 'Выездная дегустация'], ['custom-design', 'Индивидуальное оформление'], ['fondant', 'Лепка из мастики'],
  ]),
  PREPAYMENT, CONTRACT,
];

// ---------- стилисты и визажисты ----------
export const STILISTY_FILTERS: FilterGroup[] = [
  CITY,
  multi('service', 'Услуга', [
    ['styling', 'Стайлинг'], ['makeup', 'Макияж'], ['hair', 'Причёска'], ['shopping', 'Шопинг'], ['turnkey', 'Под ключ'], ['bridal-look', 'Свадебный образ'], ['escort', 'Сопровождение невесты'],
  ], true),
  single('minBudget', 'Минимальный бюджет', money([
    ['0-10', 'до 10 тыс. ₽'], ['10-15', '10–15 тыс. ₽'], ['15-30', '15–30 тыс. ₽'], ['30-60', '30–60 тыс. ₽'], ['60-100', '60–100 тыс. ₽'], ['100+', 'более 100 тыс. ₽'],
  ]), true),
  single('leadTime', 'Сроки подготовки', [['0-3d', 'до 3 дней'], ['3-7d', '3–7 дней'], ['7-30d', '7–30 дней'], ['30d+', 'более месяца']]),
  yesNo('groom', 'Работа с женихом и свидетелями'),
  yesNo('onSite', 'Выезд в день свадьбы', 'Выезд в день свадьбы'),
  PREPAYMENT, CONTRACT,
];

// ---------- диджеи ----------
export const DJ_FILTERS: FilterGroup[] = [
  CITY,
  single('priceHour', 'Цена за час', money([
    ['0-4', 'до 4 тыс. ₽'], ['4-5', '4–5 тыс. ₽'], ['5-7', '5–7 тыс. ₽'], ['7-10', '7–10 тыс. ₽'], ['10+', 'более 10 тыс. ₽'],
  ]), true),
  multi('serviceType', 'Тип услуги', [['dj', 'Только диджей'], ['mc', 'С MC'], ['light', 'Со светом'], ['themed', 'Тематический сет']], true),
  single('minBudget', 'Минимальный бюджет', money([
    ['0-10', 'до 10 тыс. ₽'], ['10-20', '10–20 тыс. ₽'], ['20-30', '20–30 тыс. ₽'], ['30-50', '30–50 тыс. ₽'], ['50+', 'более 50 тыс. ₽'],
  ])),
  single('minTime', 'Минимальное время', [['0-1h', 'до 1 часа'], ['1-3h', '1–3 часа'], ['3-6h', '3–6 часов'], ['6h+', 'более 6 часов']]),
  yesNo('equipment', 'Своё оборудование', 'Своё оборудование'),
  yesNo('national', 'Национальный репертуар'),
  single('leadTime', 'Сроки подготовки плейлиста', [['1-2d', '1–2 дня'], ['3-7d', '3–7 дней'], ['7d+', 'более 7 дней']]),
  PREPAYMENT, CONTRACT,
];

// ---------- кавер-группы ----------
export const KAVER_FILTERS: FilterGroup[] = [
  CITY,
  multi('style', 'Стиль и эпоха', [['pop', 'Поп'], ['rock', 'Рок'], ['disco', 'Диско'], ['90s', '90-е'], ['latin', 'Латина'], ['jazz', 'Джаз'], ['acoustic', 'Акустика']], true),
  multi('format', 'Формат', [['background', 'Фоновая программа'], ['dance', 'Танцы'], ['first-dance', 'Первый танец'], ['interactive', 'Интерактив'], ['themed', 'Тематический сет']]),
  single('lineup', 'Состав', [['full', 'Полный состав'], ['mini', 'Мини-состав'], ['duo-trio', 'Дуэт / трио']]),
  single('minBudget', 'Минимальный бюджет', money([['0-100', 'до 100 тыс. ₽'], ['100-300', '100–300 тыс. ₽'], ['300+', 'более 300 тыс. ₽']]), true),
  single('minTime', 'Минимальное время', [['0-15m', 'до 15 минут'], ['15-30m', '15–30 минут'], ['30-60m', '30–60 минут'], ['60m+', 'более часа']]),
  yesNo('timingSync', 'Синхронизация с таймингом'),
  yesNo('equipment', 'Своё оборудование', 'Своё оборудование'),
  single('leadTime', 'Сроки подготовки сетлиста', [['1-2d', '1–2 дня'], ['3-7d', '3–7 дней'], ['7d+', 'более 7 дней']]),
  PREPAYMENT, CONTRACT,
];

// ---------- вокалисты и музыканты (один документ на обе категории) ----------
export const VOKAL_FILTERS: FilterGroup[] = [
  CITY,
  multi('genre', 'Жанр и эпоха', [['jazz', 'Джаз'], ['lounge', 'Лаунж'], ['pop-cover', 'Поп-кавер'], ['rock-acoustic', 'Рок-акустика'], ['classic', 'Классика'], ['soul', 'Соул'], ['ethnic', 'Этника']], true),
  multi('format', 'Формат', [['background', 'Фоновая программа'], ['solo-number', 'Сольный номер'], ['first-dance', 'Первый танец'], ['themed', 'Тематический вечер'], ['interactive', 'Интерактив']]),
  single('lineup', 'Состав', [['solo', 'Соло'], ['duo', 'Дуэт'], ['vocal-instrument', 'Вокал + инструмент'], ['trio', 'Трио'], ['ensemble', 'Ансамбль']]),
  single('minBudget', 'Минимальный бюджет', money([
    ['0-30', 'до 30 тыс. ₽'], ['30-60', '30–60 тыс. ₽'], ['60-100', '60–100 тыс. ₽'], ['100-300', '100–300 тыс. ₽'], ['300+', 'более 300 тыс. ₽'],
  ]), true),
  single('minTime', 'Минимальное время', [['0-15m', 'до 15 минут'], ['15-30m', '15–30 минут'], ['30-60m', '30–60 минут'], ['1-3h', '1–3 часа'], ['3h+', 'более 3 часов']]),
  yesNo('timingSync', 'Синхронизация с таймингом'),
  yesNo('equipment', 'Своё оборудование', 'Своё оборудование'),
  single('leadTime', 'Сроки подготовки сетлиста', [['1-2d', '1–2 дня'], ['3-7d', '3–7 дней'], ['7d+', 'более 7 дней']]),
  PREPAYMENT, CONTRACT,
];

// ---------- спецэффекты ----------
export const SPECEFFEKTY_FILTERS: FilterGroup[] = [
  CITY,
  multi('effects', 'Тип эффектов', [
    ['fireworks', 'Фейерверки'], ['cold-fountains', 'Холодные фонтаны'], ['smoke', 'Дым и туман'], ['cryo', 'Крио'], ['confetti', 'Конфетти'],
    ['mapping', 'Маппинг'], ['laser', 'Лазер'], ['light-installations', 'Световые инсталляции'], ['fire-show', 'Файер-шоу'],
  ], true),
  multi('scenario', 'Сценарий', [['first-dance', 'Первый танец'], ['finale', 'Финал'], ['cake', 'Вынос торта'], ['entrance', 'Проход'], ['climax', 'Кульминация']]),
  single('minBudget', 'Минимальный бюджет', money([
    ['0-10', 'до 10 тыс. ₽'], ['10-30', '10–30 тыс. ₽'], ['30-60', '30–60 тыс. ₽'], ['60-100', '60–100 тыс. ₽'], ['100+', 'более 100 тыс. ₽'],
  ]), true),
  yesNo('sync', 'Синхронизация с музыкой и видео'),
  single('leadTime', 'Сроки подготовки', [['1-3d', '1–3 дня'], ['3-7d', '3–7 дней'], ['7d+', 'более 7 дней']]),
  yesNo('permits', 'Допуски и аттестаты', 'С допусками'),
  PREPAYMENT, CONTRACT,
];

// ---------- прокат оборудования (аренда звука и света — один документ) ----------
export const PROKAT_FILTERS: FilterGroup[] = [
  CITY,
  multi('equipment', 'Категория оборудования', [
    ['acoustics', 'Акустика'], ['mixers', 'Микшеры'], ['mics', 'Микрофоны'], ['light', 'Свет'], ['effects', 'Генераторы эффектов'], ['screens', 'Экраны'], ['trusses', 'Фермы и стойки'],
  ], true),
  multi('scenario', 'Сценарий', [
    ['background', 'Фоновая музыка'], ['dance', 'Танцы'], ['ceremony', 'Церемония'], ['photozone', 'Фотозона'], ['show', 'Шоу'], ['video', 'Видео'], ['disco', 'Дискотека'], ['karaoke', 'Караоке'],
  ]),
  single('minBudget', 'Минимальный бюджет', money([
    ['0-30', 'до 30 тыс. ₽'], ['30-60', '30–60 тыс. ₽'], ['60-100', '60–100 тыс. ₽'], ['100-300', '100–300 тыс. ₽'], ['300-500', '300–500 тыс. ₽'], ['500+', 'более 500 тыс. ₽'],
  ]), true),
  single('minRent', 'Минимальная аренда', [['0-3h', 'до 3 часов'], ['3-6h', '3–6 часов'], ['6-12h', '6–12 часов'], ['12-24h', '12–24 часа'], ['24h+', 'более суток']]),
  multi('package', 'Услуги в пакете', [['rent', 'Только прокат'], ['rent-install', 'Прокат + монтаж'], ['turnkey', 'Под ключ с оператором']]),
  yesNo('operator', 'Оператор / техспециалист', 'С техником'),
  single('leadTime', 'Сроки бронирования', [['0-24h', 'до 24 часов'], ['3-7d', '3–7 дней'], ['7d+', 'более 7 дней']]),
  yesNo('deposit', 'Залог'),
  PREPAYMENT, CONTRACT,
];

// ---------- хореографы ----------
export const HOREOGRAFY_FILTERS: FilterGroup[] = [
  CITY,
  yesNo('onSite', 'Выезд на площадку', 'Выезд на площадку'),
  multi('style', 'Стиль танца', [
    ['waltz', 'Вальс'], ['tango', 'Танго'], ['latin', 'Латина'], ['rumba', 'Румба'], ['contemporary', 'Contemporary'], ['modern', 'Современная хореография'], ['hiphop', 'Хип-хоп'], ['retro', 'Ретро'], ['mix', 'Микс'],
  ], true),
  multi('level', 'Уровень пары', [['zero', 'С нуля'], ['beginner', 'Начальный'], ['intermediate', 'Средний'], ['advanced', 'Продвинутый']]),
  multi('type', 'Тип постановки', [
    ['first-dance', 'Первый танец'], ['parent-dance', 'Танец с родителями'], ['parents', 'Танец родителей'], ['guests', 'Групповой танец гостей'], ['show', 'Шоу-номер'],
  ], true),
  single('priceTier', 'Ценовой диапазон', [['budget', 'Бюджетный'], ['medium', 'Средний'], ['high', 'Высокий'], ['premium', 'Премиум']], true),
  single('leadTime', 'Срок постановки', [['0-3d', 'до 3 дней'], ['3-7d', '3–7 дней'], ['1-2w', '1–2 недели'], ['2-4w', '2–4 недели'], ['1m+', 'месяц и больше']]),
  multi('rehearsal', 'Формат репетиций', [['studio', 'Только студия'], ['studio-onsite', 'Студия + выезд'], ['online-offline', 'Онлайн-разбор + очные'], ['venue', 'Выезд на площадку свадьбы']]),
  single('experience', 'Стаж', [['0-1', 'до года'], ['1-3', '1–3 года'], ['3-5', '3–5 лет'], ['5+', 'более 5 лет']]),
  multi('flexibility', 'График', [['evenings-weekends', 'Вечера и выходные'], ['tight', 'Сжатые сроки']]),
];

// ---------- аниматоры ----------
export const ANIMATORY_FILTERS: FilterGroup[] = [
  CITY,
  multi('format', 'Формат', [
    ['welcome', 'Welcome'], ['kids', 'Детская программа'], ['adults', 'Взрослые интерактивы'], ['themed-show', 'Тематические шоу'], ['workshops', 'Мастер-классы'], ['photo-animation', 'Фотоанимация'],
  ], true),
  multi('audience', 'Аудитория', [['kids', 'Дети'], ['teens', 'Подростки'], ['adults', 'Взрослые'], ['mixed', 'Смешанная']]),
  single('minBudget', 'Минимальный бюджет', money([
    ['0-5', 'до 5 тыс. ₽'], ['5-10', '5–10 тыс. ₽'], ['10-30', '10–30 тыс. ₽'], ['30-60', '30–60 тыс. ₽'], ['60+', 'более 60 тыс. ₽'],
  ]), true),
  single('minTime', 'Минимальное время', [['0-30m', 'до 30 минут'], ['30-60m', '30–60 минут'], ['1-3h', '1–3 часа'], ['3-6h', '3–6 часов'], ['6h+', 'более 6 часов']]),
  yesNo('props', 'Реквизит и фотозона', 'С реквизитом'),
  multi('characters', 'Персонажи', [['superheroes', 'Супергерои'], ['fairytale', 'Сказки'], ['retro', 'Ретро'], ['neutral', 'Нейтральные'], ['original', 'Авторские']]),
  LEAD_TIME_SHORT,
  PREPAYMENT, CONTRACT,
  yesNo('deposit', 'Залог'),
];

// ---------- фокусники и иллюзионисты ----------
export const FOKUSNIKI_FILTERS: FilterGroup[] = [
  CITY,
  multi('format', 'Формат', [['micromagic', 'Микромагия'], ['stage', 'Сценическое шоу'], ['special-moment', 'Спецмомент'], ['kids', 'Детская программа'], ['themed', 'Тематическое шоу']], true),
  multi('audience', 'Аудитория', [['adults', 'Взрослые'], ['mixed', 'Смешанная'], ['kids', 'Дети'], ['vip', 'VIP']]),
  single('minBudget', 'Минимальный бюджет', money([['0-30', 'до 30 тыс. ₽'], ['30-50', '30–50 тыс. ₽'], ['50-100', '50–100 тыс. ₽'], ['100+', 'более 100 тыс. ₽']]), true),
  yesNo('assistant', 'Ассистент'),
  yesNo('photozone', 'Реквизитная фотозона', 'С фотозоной'),
  LEAD_TIME_SHORT,
  PREPAYMENT, CONTRACT,
];

// ---------- авто и трансфер ----------
export const AVTO_FILTERS: FilterGroup[] = [
  CITY,
  multi('serviceType', 'Тип услуги', [['no-driver', 'Прокат без водителя'], ['with-driver', 'Трансфер с водителем'], ['group', 'Групповой трансфер'], ['turnkey', 'Под ключ']], true),
  multi('carClass', 'Класс авто', [
    ['economy', 'Эконом'], ['comfort', 'Комфорт'], ['business', 'Бизнес'], ['premium', 'Премиум'], ['limo', 'Лимузин'], ['minibus', 'Микроавтобус'], ['bus', 'Автобус'], ['retro', 'Ретро'], ['electric', 'Электромобиль'],
  ], true),
  single('minBudget', 'Минимальный бюджет', money([['0-20', 'до 20 тыс. ₽'], ['20-30', '20–30 тыс. ₽'], ['30-50', '30–50 тыс. ₽'], ['50+', 'более 50 тыс. ₽']])),
  single('minTime', 'Минимальное время', [['0-1h', 'до часа'], ['1-3h', '1–3 часа'], ['3-6h', '3–6 часов'], ['6h+', 'более 6 часов']]),
  multi('options', 'Включённые опции', [['decor', 'Декор'], ['child-seats', 'Детские кресла'], ['water-chargers', 'Вода и зарядки'], ['backup', 'Резервное авто'], ['tracking', 'Отслеживание']]),
  multi('routes', 'Маршруты', [['city', 'Город'], ['country', 'Загород'], ['airport', 'Аэропорт'], ['photo-stops', 'Фотостопы'], ['night', 'Ночные']]),
  single('leadTime', 'Сроки бронирования', [['24h', 'Экспресс 24 часа'], ['3-7d', 'Стандарт 3–7 дней'], ['7d+', 'более 7 дней']]),
  PREPAYMENT, CONTRACT,
  yesNo('insurance', 'Страхование', 'Со страховкой'),
];

/** Наборы по slug категории. Шоу — документа с фильтрами нет, категория
 *  остаётся без фильтров, пока заказчик не пришлёт. */
export const FILTERS_BY_CATEGORY: Record<string, FilterGroup[]> = {
  vedushchie: VEDUSHCHIE_FILTERS,
  fotografy: FOTOGRAFY_FILTERS,
  dekoratory: DEKORATORY_FILTERS,
  organizatory: ORGANIZATORY_FILTERS,
  koordinatory: KOORDINATORY_FILTERS,
  videografy: VIDEOGRAFY_FILTERS,
  'rils-meikery': RILS_FILTERS,
  keitering: KEITERING_FILTERS,
  konditery: KONDITERY_FILTERS,
  stilisty: STILISTY_FILTERS,
  dj: DJ_FILTERS,
  'kaver-gruppy': KAVER_FILTERS,
  vokalisty: VOKAL_FILTERS,
  muzykanty: VOKAL_FILTERS,
  speceffekty: SPECEFFEKTY_FILTERS,
  'arenda-zvuka': PROKAT_FILTERS,
  'arenda-sveta': PROKAT_FILTERS,
  horeografy: HOREOGRAFY_FILTERS,
  animatory: ANIMATORY_FILTERS,
  fokusniki: FOKUSNIKI_FILTERS,
  avto: AVTO_FILTERS,
};
