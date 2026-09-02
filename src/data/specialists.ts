// ============================================================
// КАТАЛОГ ПОДРЯДЧИКОВ — раздел «Специалисты».
// Начинаем с одной категории (Ведущие), чтобы отработать паттерн:
// фильтр слева + сетка карточек. Остальные 18 категорий подключаются
// тем же способом — свой набор FilterGroup[] и свой массив в SPECIALISTS.
// ============================================================

export interface FilterOption {
  value: string;
  label: string;
  /** Пункт попадает в блок «Популярные фильтры» шторки и в полосу быстрых
      чипов над каталогом. Строка — своя подпись для чипа: у пунктов
      «Да/Нет» вне группы нужна фраза («Свой диджей», не «Да»). */
  popular?: boolean | string;
}

export interface FilterGroup {
  key: string;
  label: string;
  /** single — один вариант (radio), multi — можно несколько (checkbox) */
  type: 'single' | 'multi';
  options: FilterOption[];
  /** Группа получает свой чип с кареткой в полосе над каталогом
      («Цена ▾»): клик открывает шторку, прокрученную к этой группе. */
  quick?: boolean;
}

export interface Specialist {
  slug: string;
  categorySlug: string;
  category: string;

  name: string;
  /** кадры карточки: [0] — главный; на широкой карточке видно два сразу */
  photos: string[];
  /** одна короткая строка под именем — единственный текст карточки */
  tagline: string;
  /** 2-3 предложения о специалисте — только на странице-визитке */
  bio: string;

  gender: 'м' | 'ж';
  /** цена за 6 часов работы, ₽ — нижняя граница диапазона */
  priceFrom: number;
  cities: string[];
  styles: string[];
  age: 'до 25' | '25–35' | '35–50' | '50+';
  experienceYears: number;
  hasOwnDJ: boolean;
  formats: string[];
  languages: string[];
  ceremonyMaster: boolean;
  hasEquipment: boolean;

  rating: number;
  reviews: number;
  demo?: boolean;

  /** ============ СТРАНИЦА-ВИЗИТКА: пока заполнено не у всех (прототип) ============ */
  /** предложение от специалиста — формулирует сам, рендерится цитатой */
  quote?: string;
  /** предложения от специалиста — короткие карточки на странице-визитке */
  offers?: { title: string; text: string }[];
  /** вертикальные видео-reels; пока только постеры-заглушки, video появится
      с реальными файлами (напр. /reels/anton-1.mp4 в public) */
  reels?: { poster: string; video?: string }[];
  /** отзывы для блока на визитке (reviews выше — только счётчик для карточки);
      photo необязательно — без него рендерится кружок с инициалами */
  reviewsList?: { author: string; date: string; text: string; rating: number; photo?: string }[];
}

// ============ ВСЕ 19 КАТЕГОРИЙ СПЕЦИАЛИСТОВ ============
// Единый список для переключателя категорий (CategoryNav) — источник
// правды для порядка и подписей пилюль. Живая категория пока одна
// (vedushchie), остальные рендерятся страницей-заглушкой.
export interface SpecialistCategory {
  slug: string;
  label: string;
}

export const SPECIALIST_CATEGORIES: SpecialistCategory[] = [
  { slug: 'vedushchie', label: 'Ведущие' },
  { slug: 'dj', label: 'Диджеи' },
  { slug: 'fotografy', label: 'Фотографы' },
  { slug: 'videografy', label: 'Видеографы' },
  { slug: 'dekoratory', label: 'Декораторы' },
  { slug: 'konditery', label: 'Кондитеры' },
  { slug: 'keitering', label: 'Кейтеринг' },
  { slug: 'koordinatory', label: 'Координаторы' },
  { slug: 'organizatory', label: 'Организаторы' },
  { slug: 'stilisty', label: 'Стилисты' },
  { slug: 'prokat', label: 'Прокат' },
  { slug: 'prokatchiki', label: 'Прокатчики' },
  { slug: 'animatory', label: 'Аниматоры' },
  { slug: 'horeografy', label: 'Хореографы' },
  { slug: 'fokusniki', label: 'Фокусники' },
  { slug: 'speceffekty', label: 'Спецэффекты' },
  { slug: 'kaver-gruppy', label: 'Кавер-группы' },
  { slug: 'vokalisty', label: 'Вокалисты' },
  { slug: 'rils-meikery', label: 'Рилс-мейкеры' },
];

// ============ СМЫСЛОВЫЕ ГРУППЫ НАПРАВЛЕНИЙ ============
// 19 категорий подряд человек не читает — он ищет «кто снимает» или
// «кто оформляет». Группы идут по ходу подготовки свадьбы: сначала те,
// кого бронируют первыми (организатор, ведущий), в конце — образ.
// Источник правды для хаба раздела; сюда же будет смотреть блок
// «соберите команду» на карточке специалиста.
// Категория, не попавшая ни в одну группу, не теряется — хаб собирает
// остаток в отдельный ряд (см. index.astro раздела).
export interface SpecialistGroup {
  key: string;
  label: string;
  /** подпись для узкой навигации (CategoryNav): все 6 групп обязаны
      уместиться в одну строку, полный label туда не влезает */
  short: string;
  /** slug'и категорий в порядке показа внутри группы */
  categories: string[];
}

export const SPECIALIST_GROUPS: SpecialistGroup[] = [
  {
    key: 'organizacija',
    label: 'Организация и ведение',
    short: 'Организация',
    categories: ['organizatory', 'koordinatory', 'vedushchie'],
  },
  {
    key: 'semka',
    label: 'Съёмка',
    short: 'Съёмка',
    categories: ['fotografy', 'videografy', 'rils-meikery'],
  },
  {
    key: 'muzyka',
    label: 'Музыка и шоу',
    short: 'Музыка и шоу',
    categories: ['dj', 'kaver-gruppy', 'vokalisty', 'horeografy', 'animatory', 'fokusniki', 'speceffekty'],
  },
  {
    key: 'oformlenie',
    label: 'Оформление и аренда',
    short: 'Оформление',
    categories: ['dekoratory', 'prokat', 'prokatchiki'],
  },
  {
    key: 'ugoshchenie',
    label: 'Угощение',
    short: 'Угощение',
    categories: ['keitering', 'konditery'],
  },
  {
    // пока одна категория, но группа заготовлена под рост: визажисты,
    // причёски, платья и костюмы приедут именно сюда
    key: 'obraz',
    label: 'Образ',
    short: 'Образ',
    categories: ['stilisty'],
  },
];

const IMG_M = '/specialists/vedushchie/m';
const IMG_F = '/specialists/vedushchie/f';

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
    label: 'Пол',
    type: 'single',
    options: [
      { value: 'м', label: 'Мужской' },
      { value: 'ж', label: 'Женский' },
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

// ============ КАРТОЧКИ: ВЕДУЩИЕ (демо-набор для дизайна) ============
// Подпись (tagline) — одна короткая строка: на карточке кроме неё
// только имя, рейтинг и метки на фото. Длинные описания — на странице.
export const VEDUSHCHIE: Specialist[] = [
  {
    slug: 'anton-volkov',
    categorySlug: 'vedushchie',
    category: 'Ведущие',
    name: 'Антон Волков',
    photos: [
      `${IMG_M}/m08.jpg`,
      `${IMG_M}/m21.jpg`,
      `${IMG_M}/m42.jpg`,
      `${IMG_M}/m16.jpg`,
      `${IMG_M}/m27.jpg`,
      `${IMG_M}/m36.jpg`,
    ],
    tagline: 'Лёгкий юмор, ноль пошлости',
    bio: 'Ведёт свадьбы больше десяти лет — начинал с корпоративов, но быстро понял: настоящий кайф именно в свадебном формате, где эмоции честные, а не заученная реакция зала. За это время провёл больше пятидесяти свадеб — от камерных на 20 человек до банкетов на полторы сотни гостей.\n\nСтроит вечер вокруг пары, а не вокруг конкурсов: перед свадьбой обязательно созванивается, узнаёт историю знакомства, вычисляет, что точно не понравится гостям. Работает в связке со своим диджеем — вместе собирают плейлист под характер компании, поэтому пауз между блоками почти не бывает.',
    gender: 'м',
    priceFrom: 75000,
    cities: ['цао', 'сао', 'mo'],
    styles: ['no-vulgar', 'modern', 'humor'],
    age: '35–50',
    experienceYears: 12,
    hasOwnDJ: true,
    formats: ['medium', 'large', 'anniversary'],
    languages: ['ru'],
    ceremonyMaster: true,
    hasEquipment: true,
    rating: 4.9,
    reviews: 58,
    demo: true,
    quote:
      'Перед бронированием — пробный созвон: обсудим сценарий, стиль ведения и пожелания, бесплатно и ни к чему не обязывает. Бронируете дату за три месяца и раньше — минус 10%: у меня появляется время собрать сценарий именно под вашу пару. И берите комплект «ведущий + диджей»: мы работаем одной командой, поэтому пауз между блоками вечера просто не бывает.',
    reels: [
      { poster: `${IMG_M}/m19.jpg` },
      { poster: `${IMG_M}/m23.jpg` },
      { poster: `${IMG_M}/m29.jpg` },
      { poster: `${IMG_M}/m54.jpg` },
    ],
    reviewsList: [
      {
        author: 'Мария и Дмитрий',
        date: '14 июня 2026',
        text: 'Антон полностью прочувствовал, чего мы хотим — никакой пошлости, только тёплая атмосфера. За месяц до свадьбы созвонились, разобрали историю знакомства, и половина вечера была построена на деталях, которые знали только мы. Гости до сих пор вспоминают вечер.',
        rating: 5,
      },
      {
        author: 'Ольга и Сергей',
        date: '25 апреля 2026',
        text: 'Отдельное спасибо за работу с диджеем в связке — вечер шёл без единой заминки, танцпол не пустовал ни минуты. Родители, которые «не танцуют», ушли с танцпола последними.',
        rating: 5,
      },
      {
        author: 'Анна и Павел',
        date: '13 февраля 2026',
        text: 'Изначально боялись классического формата тамады, но Антон предложил современный сценарий без банальных конкурсов. Единственное — хотелось чуть больше времени на свободное общение, но это мы сами перегрузили тайминг.',
        rating: 4,
      },
      {
        author: 'Ксения и Артём',
        date: '19 декабря 2025',
        text: 'Камерная свадьба на двадцать человек — боялись, что с ведущим будет «слишком официально». Получилось наоборот: как будто вечер вёл близкий друг семьи, который почему-то знает всех по именам.',
        rating: 5,
      },
    ],
  },
  {
    slug: 'marina-lebedeva',
    categorySlug: 'vedushchie',
    category: 'Ведущие',
    name: 'Марина Лебедева',
    photos: [`${IMG_F}/f04.jpg`, `${IMG_F}/f07.jpg`, `${IMG_F}/f12.jpg`],
    tagline: 'Камерные свадьбы на двух языках',
    bio: 'Специализируется на камерных свадьбах — от 10 до 40 человек, где важен каждый гость и разговор, а не громкий тамада-формат. Ведёт на двух языках без потери интонации — удобно для смешанных пар и гостей из-за границы. Сценарий собирает вместе с парой на созвоне за месяц до даты.',
    gender: 'ж',
    priceFrom: 95000,
    cities: ['цао', 'зао', 'сзао'],
    styles: ['bilingual', 'intelligent', 'classic'],
    age: '25–35',
    experienceYears: 7,
    hasOwnDJ: false,
    formats: ['intimate', 'engagement'],
    languages: ['ru', 'en'],
    ceremonyMaster: true,
    hasEquipment: false,
    rating: 4.8,
    reviews: 34,
    demo: true,
  },
  {
    slug: 'igor-sokolov',
    categorySlug: 'vedushchie',
    category: 'Ведущие',
    name: 'Игорь Соколов',
    photos: [`${IMG_M}/m03.jpg`, `${IMG_M}/m39.jpg`, `${IMG_M}/m67.jpg`],
    tagline: 'Шоу и интерактив для больших залов',
    bio: 'Работает с залами на 100+ гостей: держит энергию весь вечер через интерактив и элементы шоу, а не через микрофон и стандартные тосты. Приезжает с готовым диджей-сетом и реквизитом для конкурсов. Особенно любит гендер-пати — умеет удивить даже видавших виды гостей.',
    gender: 'м',
    priceFrom: 130000,
    cities: ['юао', 'юво', 'mo', 'вне-мо'],
    styles: ['show', 'interactive', 'modern'],
    age: '35–50',
    experienceYears: 16,
    hasOwnDJ: true,
    formats: ['large', 'gender-party', 'anniversary'],
    languages: ['ru'],
    ceremonyMaster: false,
    hasEquipment: true,
    rating: 4.7,
    reviews: 71,
    demo: true,
  },
  {
    slug: 'ekaterina-orlova',
    categorySlug: 'vedushchie',
    category: 'Ведущие',
    name: 'Екатерина Орлова',
    photos: [`${IMG_F}/f51.jpg`, `${IMG_F}/f52.jpg`, `${IMG_F}/f53.jpg`],
    tagline: 'Тёплая классика без клише',
    bio: 'Ведёт тепло и без клише — никаких конкурсов «свяжите ленточку», только живой разговор с гостями и уважение к сценарию пары. Хорошо чувствует камерные и средние форматы, где важна атмосфера, а не масштаб. Перед свадьбой обязательно встречается с парой лично, а не только по видеосвязи.',
    gender: 'ж',
    priceFrom: 65000,
    cities: ['свао', 'вао', 'mo'],
    styles: ['classic', 'intelligent', 'no-vulgar'],
    age: '25–35',
    experienceYears: 5,
    hasOwnDJ: false,
    formats: ['intimate', 'medium', 'engagement'],
    languages: ['ru'],
    ceremonyMaster: true,
    hasEquipment: false,
    rating: 4.9,
    reviews: 21,
    demo: true,
  },
  {
    slug: 'dmitriy-kuznetsov',
    categorySlug: 'vedushchie',
    category: 'Ведущие',
    name: 'Дмитрий Кузнецов',
    photos: [`${IMG_M}/m23.jpg`, `${IMG_M}/m54.jpg`, `${IMG_M}/m19.jpg`],
    tagline: '22 года за микрофоном',
    bio: '22 года за микрофоном — начинал ещё в 2000-х, видел все форматы свадеб и знает, как держать зал даже без диджея, хотя обычно работает в связке со своим. Классическая подача с уместным юмором, без резких шуток. Часто ведёт не только свадьбы, но и годовщины той же пары — многие зовут повторно.',
    gender: 'м',
    priceFrom: 110000,
    cities: ['юзао', 'зао', 'mo', 'вне-мо'],
    styles: ['classic', 'humor'],
    age: '50+',
    experienceYears: 22,
    hasOwnDJ: true,
    formats: ['medium', 'large', 'anniversary', 'gender-party'],
    languages: ['ru'],
    ceremonyMaster: false,
    hasEquipment: true,
    rating: 4.6,
    reviews: 89,
    demo: true,
  },
  {
    slug: 'alina-belova',
    categorySlug: 'vedushchie',
    category: 'Ведущие',
    name: 'Алина Белова',
    photos: [`${IMG_F}/f16.jpg`, `${IMG_F}/f44.jpg`, `${IMG_F}/f59.jpg`],
    tagline: 'Современно и легко',
    bio: 'Молодой ведущий современного формата — легко находит общий язык с гостями своего поколения, без старых шаблонов сценариев. Специализируется на камерных свадьбах и помолвках, где важна лёгкость, а не масштабные конкурсы. Может провести часть вечера на английском для смешанных компаний.',
    gender: 'ж',
    priceFrom: 55000,
    cities: ['цао', 'сао', 'свао'],
    styles: ['modern', 'interactive', 'no-vulgar'],
    age: 'до 25',
    experienceYears: 3,
    hasOwnDJ: false,
    formats: ['intimate', 'engagement'],
    languages: ['ru', 'en'],
    ceremonyMaster: true,
    hasEquipment: false,
    rating: 4.7,
    reviews: 12,
    demo: true,
  },
  {
    slug: 'sergey-panov',
    categorySlug: 'vedushchie',
    category: 'Ведущие',
    name: 'Сергей Панов',
    photos: [`${IMG_M}/m20.jpg`, `${IMG_M}/m26.jpg`, `${IMG_M}/m36.jpg`],
    tagline: 'Церемонии и большие банкеты',
    bio: 'Один из немногих, кто одинаково уверенно ведёт и выездную церемонию, и большой банкет на 150+ человек — от первого «да» до последнего танца. За 18 лет собрал свою команду звука и света, работает с ней синхронно. Подача классическая, с элементами шоу там, где это уместно, а не везде подряд.',
    gender: 'м',
    priceFrom: 160000,
    cities: ['цао', 'зао', 'mo', 'вне-мо'],
    styles: ['show', 'classic'],
    age: '35–50',
    experienceYears: 18,
    hasOwnDJ: true,
    formats: ['large', 'ceremony'],
    languages: ['ru', 'en'],
    ceremonyMaster: true,
    hasEquipment: true,
    rating: 4.9,
    reviews: 104,
    demo: true,
  },
  {
    slug: 'olga-romanova',
    categorySlug: 'vedushchie',
    category: 'Ведущие',
    name: 'Ольга Романова',
    photos: [`${IMG_F}/f17.jpg`, `${IMG_F}/f23.jpg`, `${IMG_F}/f60.jpg`],
    tagline: 'Интеллигентно, по-семейному',
    bio: 'Ведёт по-семейному — так, будто знакома с гостями лично, а не читает сценарий по бумажке. Хорошо подходит парам, которые хотят тёплую атмосферу без пошлых конкурсов и надрыва. Часто зовут на юбилеи свадеб — уже сложившаяся аудитория ценит её манеру.',
    gender: 'ж',
    priceFrom: 85000,
    cities: ['сао', 'сзао', 'mo'],
    styles: ['intelligent', 'no-vulgar'],
    age: '35–50',
    experienceYears: 9,
    hasOwnDJ: false,
    formats: ['intimate', 'medium', 'anniversary'],
    languages: ['ru'],
    ceremonyMaster: true,
    hasEquipment: false,
    rating: 4.8,
    reviews: 47,
    demo: true,
  },
  {
    slug: 'maksim-goncharov',
    categorySlug: 'vedushchie',
    category: 'Ведущие',
    name: 'Максим Гончаров',
    photos: [`${IMG_M}/m06.jpg`, `${IMG_M}/m18.jpg`, `${IMG_M}/m29.jpg`],
    tagline: 'Драйв, диджей в комплекте',
    bio: 'Драйвовый формат для больших свадеб — работает в связке со своим диджеем, поэтому звук и ведение выстроены как единое шоу, а не два отдельных подрядчика. Специализируется на масштабных форматах и гендер-пати, где нужна энергия на весь вечер. Один из самых бронируемых в верхнем ценовом сегменте.',
    gender: 'м',
    priceFrom: 210000,
    cities: ['цао', 'юзао', 'mo', 'вне-мо'],
    styles: ['show', 'interactive', 'humor'],
    age: '25–35',
    experienceYears: 8,
    hasOwnDJ: true,
    formats: ['large', 'gender-party'],
    languages: ['ru'],
    ceremonyMaster: false,
    hasEquipment: true,
    rating: 4.8,
    reviews: 66,
    demo: true,
  },
  {
    slug: 'anna-tsaryova',
    categorySlug: 'vedushchie',
    category: 'Ведущие',
    name: 'Анна Царёва',
    photos: [`${IMG_F}/f61.jpg`, `${IMG_F}/f62.jpg`, `${IMG_F}/f55.jpg`],
    tagline: 'Вечер, который танцует',
    bio: 'Строит вечер вокруг танцпола — с первых минут вовлекает гостей, а не ждёт полуночи, чтобы «раскачать» зал. Хорошо работает со средними и большими компаниями, где нужен постоянный интерактив. Приезжает со своим диджеем — сценарий и музыка планируются вместе.',
    gender: 'ж',
    priceFrom: 120000,
    cities: ['вао', 'юво', 'mo'],
    styles: ['interactive', 'modern', 'show'],
    age: '25–35',
    experienceYears: 6,
    hasOwnDJ: true,
    formats: ['medium', 'large', 'gender-party'],
    languages: ['ru'],
    ceremonyMaster: false,
    hasEquipment: true,
    rating: 4.7,
    reviews: 39,
    demo: true,
  },
  {
    slug: 'pavel-krylov',
    categorySlug: 'vedushchie',
    category: 'Ведущие',
    name: 'Павел Крылов',
    photos: [`${IMG_M}/m16.jpg`, `${IMG_M}/m27.jpg`, `${IMG_M}/m60.jpg`],
    tagline: 'Классика жанра для 30–80 гостей',
    bio: 'Классика жанра без импровизаций «на грани» — подходит парам, которые хотят традиционный сценарий с тостами и конкурсами, но без пошлости. Комфортно чувствует себя с компаниями 30–80 человек. Работает без своего диджея, поэтому заранее согласовывает тайминг с музыкальным подрядчиком.',
    gender: 'м',
    priceFrom: 58000,
    cities: ['свао', 'вао', 'юао'],
    styles: ['classic', 'no-vulgar'],
    age: '35–50',
    experienceYears: 11,
    hasOwnDJ: false,
    formats: ['medium', 'anniversary'],
    languages: ['ru'],
    ceremonyMaster: false,
    hasEquipment: false,
    rating: 4.5,
    reviews: 28,
    demo: true,
  },
  {
    slug: 'vera-solovyova',
    categorySlug: 'vedushchie',
    category: 'Ведущие',
    name: 'Вера Соловьёва',
    photos: [`${IMG_F}/f18.jpg`, `${IMG_F}/f50.jpg`, `${IMG_F}/f56.jpg`],
    tagline: 'Нежные камерные праздники',
    bio: 'Ведёт нежные камерные праздники и выездные церемонии — там, где важнее интонация, чем громкость микрофона. Один из самых доступных по цене вариантов в каталоге, при этом с личным подходом к каждой паре. Хорошо подходит для помолвок и небольших семейных торжеств.',
    gender: 'ж',
    priceFrom: 48000,
    cities: ['зао', 'сзао', 'mo'],
    styles: ['intelligent', 'classic'],
    age: '25–35',
    experienceYears: 4,
    hasOwnDJ: false,
    formats: ['intimate', 'ceremony', 'engagement'],
    languages: ['ru'],
    ceremonyMaster: true,
    hasEquipment: false,
    rating: 4.8,
    reviews: 17,
    demo: true,
  },
];

export const SPECIALISTS_BY_CATEGORY: Record<string, Specialist[]> = {
  vedushchie: VEDUSHCHIE,
};

export const FILTERS_BY_CATEGORY: Record<string, FilterGroup[]> = {
  vedushchie: VEDUSHCHIE_FILTERS,
  fotografy: FOTOGRAFY_FILTERS,
  dekoratory: DEKORATORY_FILTERS,
};
