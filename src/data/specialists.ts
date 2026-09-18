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
  /** другие направления, где карточка тоже показывается, без второго URL:
      пара «фото + видео» ищется и в «Фотографах», и в «Видеографах», но
      визитка у неё одна — дубль страницы под тем же контентом вредит SEO */
  alsoCategories?: string[];

  name: string;
  /** ПОРТРЕТ САМОГО ПОДРЯДЧИКА — лицо, а не работа. Отдельным полем,
      потому что кадры галереи это разные вещи в разных категориях:
      у ведущего в photos он сам, а у фотографа, видеографа, декоратора —
      его съёмки, и автора не видно нигде. Кроп из портфолио не спасает:
      свадебный кадр ростовой, квадратный кроп даёт грудь, а не лицо.
      Файл присылает подрядчик, кладём в src/assets/specialists/<кат>/<slug>/.
      Нет портрета — на визитке кружок с инициалами, в каталоге аватарки
      просто нет (кружок с буквами на каждой карточке сетки — шум). */
  avatar?: string;
  /** ПОЛНЫЙ КАДР ПОРТРЕТА — тот же снимок, что в аватарке, целиком, в блок
      «О нас»/«О подрядчике». Аватарка это кружок 30–64 px: студийный кадр
      в полный рост в нём читается пятном, лица не разобрать. Поэтому
      портрет живёт в двух видах — кроп по головам и плечам в кружок
      (avatar) и весь кадр рядом с рассказом о себе (portrait). Есть
      только один из двух — рендерится только он. */
  portrait?: string;
  /** кадры карточки: [0] — главный; на широкой карточке видно два сразу */
  photos: string[];
  /** одна короткая строка под именем — единственный текст карточки */
  tagline: string;
  /** 2-3 предложения о специалисте — только на странице-визитке */
  bio: string;

  /** 'pair' — снимают вдвоём (фото + видео), это не «мужской/женский» */
  gender?: 'м' | 'ж' | 'pair';
  /** цена за 6 часов работы, ₽ — нижняя граница диапазона.
      Нет поля — цену не публикуют: в карточке стоит priceNote, в ценовой
      фильтр такая карточка не попадает (врать цифрой нельзя) */
  priceFrom?: number;
  /** подпись вместо цены: «по запросу» и почему так */
  priceNote?: string;
  cities?: string[];
  styles?: string[];
  age?: 'до 25' | '25–35' | '35–50' | '50+';
  experienceYears?: number;
  hasOwnDJ?: boolean;
  formats?: string[];
  languages?: string[];
  ceremonyMaster?: boolean;
  hasEquipment?: boolean;

  /** ============ ПОЛЯ СЪЁМОЧНЫХ КАТЕГОРИЙ (фото, видео, рилс) ============ */
  /** стиль съёмки, тип услуги и т.д. — значения из FOTOGRAFY_FILTERS.
      Держим одной картой, а не отдельным полем на каждый фильтр: у каждой
      из 19 категорий свой набор, схема от этого не должна раздуваться */
  filters?: Record<string, string | string[]>;
  /** что входит в пакет — список на визитке, слова подрядчика */
  packageIncludes?: string[];

  /** рейтинга нет, пока нет собранных отзывов: у реального подрядчика
      демо-звёзды рисовать нельзя */
  rating?: number;
  reviews?: number;
  demo?: boolean;

  /** ============ СТРАНИЦА-ВИЗИТКА: пока заполнено не у всех (прототип) ============ */
  /** заголовок блока с bio: «О ведущем» у карточки в третьем лице,
      «О нас» там, где подрядчик написал о себе сам */
  aboutTitle?: string;
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
  /** название раздела, множественное число — вкладки, заголовки каталога */
  label: string;
  /** кто это один — «Фотограф», «Ведущий»: бирка под именем на визитке.
      Тэглайн («Главное — люди и момент жизни») сам по себе не говорит,
      фотограф это или ведущий, а из ленты в карточку попадают без контекста
      раздела. Где единственного числа нет (кейтеринг, шоу, аренда) — то же
      слово, что в label. */
  role: string;
}

// Порядок здесь — порядок разделов ниже: категории одного раздела идут
// подряд, чтобы список читался тем же деревом, что и хаб.
export const SPECIALIST_CATEGORIES: SpecialistCategory[] = [
  { slug: 'organizatory', label: 'Организаторы', role: 'Организатор' },
  { slug: 'koordinatory', label: 'Координаторы', role: 'Координатор' },
  { slug: 'vedushchie', label: 'Ведущие', role: 'Ведущий' },
  { slug: 'dekoratory', label: 'Декораторы', role: 'Декоратор' },
  { slug: 'fotografy', label: 'Фотографы', role: 'Фотограф' },
  { slug: 'videografy', label: 'Видеографы', role: 'Видеограф' },
  { slug: 'rils-meikery', label: 'Reels-мейкеры', role: 'Reels-мейкер' },
  { slug: 'keitering', label: 'Кейтеринг', role: 'Кейтеринг' },
  { slug: 'konditery', label: 'Кондитеры', role: 'Кондитер' },
  // Раздел без вкладок: стилист и визажист на свадьбе — один заказ
  // (утро невесты целиком), поэтому и категория одна.
  { slug: 'stilisty', label: 'Стилисты и визажисты', role: 'Стилист и визажист' },
  { slug: 'dj', label: 'Диджеи', role: 'Диджей' },
  { slug: 'kaver-gruppy', label: 'Кавер-группы', role: 'Кавер-группа' },
  { slug: 'vokalisty', label: 'Вокалисты', role: 'Вокалист' },
  { slug: 'muzykanty', label: 'Музыканты', role: 'Музыкант' },
  { slug: 'speceffekty', label: 'Спецэффекты', role: 'Спецэффекты' },
  { slug: 'arenda-zvuka', label: 'Аренда звука', role: 'Аренда звука' },
  { slug: 'arenda-sveta', label: 'Аренда светомузыки', role: 'Аренда светомузыки' },
  { slug: 'horeografy', label: 'Хореографы', role: 'Хореограф' },
  { slug: 'animatory', label: 'Аниматоры', role: 'Аниматор' },
  { slug: 'shou', label: 'Шоу', role: 'Шоу' },
  { slug: 'fokusniki', label: 'Фокусники и иллюзионисты', role: 'Фокусник' },
  { slug: 'avto', label: 'Авто и трансфер', role: 'Авто и трансфер' },
];

/** Бирка «кто это» для визитки: «Фотограф», у пары — во множественном
    числе и со всеми направлениями: «Фотографы и видеографы». Ведущий
    с alsoCategories не бывает, но правило одно на всех. */
export function specialistRole(s: Pick<Specialist, 'categorySlug' | 'alsoCategories' | 'gender'>): string {
  const slugs = [s.categorySlug, ...(s.alsoCategories ?? [])];
  const pair = s.gender === 'pair';
  return slugs
    .map((slug) => SPECIALIST_CATEGORIES.find((c) => c.slug === slug))
    .filter((c): c is SpecialistCategory => !!c)
    .map((c, i) => {
      const word = pair ? c.label : c.role;
      return i === 0 ? word : word.toLowerCase();
    })
    .join(' и ');
}

// ============ СМЫСЛОВЫЕ ГРУППЫ НАПРАВЛЕНИЙ ============
// Два десятка категорий подряд человек не читает — он ищет «кто снимает»
// или «кто оформляет». Группы идут по ходу подготовки свадьбы: сначала те,
// кого бронируют первыми (организатор, ведущий), в конце — трансфер.
// Группа из ОДНОЙ категории — это раздел без вкладок: с хаба человек
// попадает сразу в каталог, второй ряд CategoryNav там не рисуется.
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
  /** обложка плитки на хабе раздела — постановочный студийный портрет
      на однотонном фоне палитры сайта (генерация image-styler, пресет
      wed-secrets-cover). Путь как у всех фото: строка от src/assets.
      Нет обложки — плитка без кадра, как было. */
  cover?: string;
  /** тон фона обложки: под него красится сама плитка, чтобы кадр
      сливался с плашкой, а не лежал прямоугольником на сером */
  tone?: 'dark' | 'beige';
}

export const SPECIALIST_GROUPS: SpecialistGroup[] = [
  {
    key: 'organizacija',
    label: 'Организация и координация',
    short: 'Организация',
    categories: ['organizatory', 'koordinatory'],
    cover: '/specialists/groups/organizacija.webp',
    tone: 'beige',
  },
  {
    key: 'vedushchie',
    label: 'Ведущие',
    short: 'Ведущие',
    categories: ['vedushchie'],
    cover: '/specialists/groups/vedushchie.webp',
    tone: 'dark',
  },
  {
    key: 'dekor',
    label: 'Декораторы',
    short: 'Декор',
    categories: ['dekoratory'],
    cover: '/specialists/groups/dekor.webp',
    tone: 'beige',
  },
  {
    key: 'foto-video',
    label: 'Фото и видео',
    short: 'Фото и видео',
    categories: ['fotografy', 'videografy', 'rils-meikery'],
    cover: '/specialists/groups/foto-video.webp',
    tone: 'beige',
  },
  {
    key: 'kuhnya',
    label: 'Кухня и сладости',
    short: 'Кухня',
    categories: ['keitering', 'konditery'],
    cover: '/specialists/groups/kuhnya.webp',
    tone: 'beige',
  },
  {
    key: 'obraz',
    label: 'Стилисты и визажисты',
    short: 'Образ',
    categories: ['stilisty'],
    cover: '/specialists/groups/obraz.webp',
    tone: 'beige',
  },
  {
    key: 'muzyka',
    label: 'Музыка и вокал',
    short: 'Музыка',
    categories: ['dj', 'kaver-gruppy', 'vokalisty', 'muzykanty'],
    cover: '/specialists/groups/muzyka.webp',
    tone: 'dark',
  },
  {
    key: 'oborudovanie',
    label: 'Оборудование и спецэффекты',
    short: 'Оборудование',
    categories: ['speceffekty', 'arenda-zvuka', 'arenda-sveta'],
    cover: '/specialists/groups/oborudovanie.webp',
    tone: 'dark',
  },
  {
    key: 'shou',
    label: 'Шоу и развлечения',
    short: 'Шоу',
    categories: ['horeografy', 'animatory', 'shou', 'fokusniki'],
    cover: '/specialists/groups/shou.webp',
    tone: 'beige',
  },
  {
    key: 'avto',
    label: 'Авто и трансфер',
    short: 'Авто',
    categories: ['avto'],
    cover: '/specialists/groups/avto.webp',
    tone: 'dark',
  },
];

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

// ============ КАРТОЧКИ: ФОТОГРАФЫ ============
// ПЕРВЫЙ РЕАЛЬНЫЙ ПОДРЯДЧИК КАТАЛОГА (не демо): Лешаковы, фото и видео.
// Тексты — их собственные, слегка причёсанные; ничего не дописано за них.
// Чего у нас пока НЕТ и что нельзя выдумывать — оставлено пустым, такая
// карточка просто не попадает в соответствующий фильтр:
//   цена (говорят «зависит от даты и часов» → priceNote),
//   рейтинг и отзывы (ни одного собранного),
//   сроки и формат выдачи, договор, предоплата, минимальный бюджет.
// Спросить у подрядчика и заполнить — тогда карточка встанет в эти фильтры.
const LSH = '/specialists/fotografy/leshakovy/gal';
const AVA_F = '/specialists/fotografy/avatars';

export const FOTOGRAFY: Specialist[] = [
  {
    slug: 'leshakovy',
    categorySlug: 'fotografy',
    category: 'Фотографы',
    // снимают комплексом — карточка стоит и в «Видеографах», визитка одна
    alsoCategories: ['videografy'],
    name: 'Юлия и Леонид Лешаковы',
    avatar: `${AVA_F}/leshakovy.webp`,
    portrait: '/specialists/fotografy/leshakovy/portrait.webp',
    photos: [
      `${LSH}/p23.webp`, `${LSH}/p21.webp`, `${LSH}/p36.webp`, `${LSH}/p31.webp`,
      `${LSH}/p16.webp`, `${LSH}/p17.webp`, `${LSH}/p18.webp`, `${LSH}/p19.webp`,
      `${LSH}/p13.webp`, `${LSH}/p14.webp`, `${LSH}/p11.webp`, `${LSH}/p12.webp`,
      `${LSH}/p09.webp`, `${LSH}/p05.webp`, `${LSH}/p06.webp`, `${LSH}/p24.webp`,
      `${LSH}/p25.webp`, `${LSH}/p26.webp`, `${LSH}/p27.webp`, `${LSH}/p28.webp`,
      `${LSH}/p30.webp`, `${LSH}/p34.webp`, `${LSH}/p37.webp`, `${LSH}/p38.webp`,
      `${LSH}/p39.webp`, `${LSH}/p20.webp`, `${LSH}/p04.webp`, `${LSH}/p07.webp`,
      `${LSH}/p08.webp`,
      // горизонтальные — в конце: в доску главной они не идут (см. lib/gallery)
      `${LSH}/p03.webp`, `${LSH}/p02.webp`, `${LSH}/p01.webp`, `${LSH}/p10.webp`,
      `${LSH}/p15.webp`, `${LSH}/p22.webp`, `${LSH}/p29.webp`, `${LSH}/p32.webp`,
      `${LSH}/p33.webp`, `${LSH}/p35.webp`,
    ],
    tagline: 'Фото и видео одним комплектом',
    bio: 'Мы Юлия и Леонид — снимаем свадьбы пятнадцать лет и знаем в этой сфере каждую мелочь. Наши работы — яркие, искренние и стильные моменты, которые не потеряют актуальности через годы ни съёмкой, ни обработкой.\n\nРаботаем в паре и снимаем комплексом «фото + видео»: съёмка занимает минимум времени, а весь материал выходит в едином стиле. Действия отточены сотнями свадеб — от вас классное настроение, всё остальное берём на себя.',
    gender: 'pair',
    priceNote: 'Зависит от даты, времени года и количества часов',
    experienceYears: 15,
    aboutTitle: 'О нас',
    filters: {
      gender: 'pair',
      city: ['цао', 'сао', 'свао', 'вао', 'юво', 'юао', 'юзао', 'зао', 'сзао', 'mo', 'вне-мо'],
      experience: '15+',
      style: ['reportage', 'staged', 'lifestyle'],
      serviceType: ['full-day'],
    },
    packageIncludes: [
      'Предварительная консультация по видеосвязи',
      'Съёмка фото и видео одним комплектом',
      'Авторская обработка 500–800 фотографий',
      'Фильм на 20–40 минут в FullHD и тизер на минуту',
      'Составление тайминга дня',
      'Подбор локаций для утра и прогулки, цветовой гаммы и стилистики',
      'Помощь с позированием',
      'Обратная связь и советы на всех этапах',
    ],
    quote:
      'Стоимость зависит от даты, времени года и количества часов — напишите нам, и мы посчитаем под ваш день. Сначала созвонимся по видеосвязи и обсудим всё до мелочей: это бесплатно и ни к чему не обязывает.',
    offers: [
      {
        title: 'Работаем в паре',
        text: 'Снимаем комплексом «фото + видео»: съёмка занимает минимум времени, а весь материал выходит в едином стиле. Действия отточены сотнями свадеб.',
      },
      {
        title: 'Консультация до свадьбы',
        text: 'Разбираем каждую деталь дня — включая те моменты, о которых вы сами ещё не думали.',
      },
      {
        title: 'Помогаем с локациями',
        text: 'Подскажем отель для сборов, места для съёмки и даже цвет костюма жениха — ждём ваши фото из примерочной.',
      },
      {
        title: 'Ставим позы',
        text: 'Вопрос «куда деть руки» просто не возникнет: позирование берём на себя, от вас — настроение.',
      },
      {
        title: 'Топовая техника Nikon',
        text: 'Объективы любой ширины, свой свет на банкете — всё, что нужно для съёмки в любых условиях.',
      },
      {
        title: 'Свои подрядчики',
        text: 'Список ведущих, визажистов и организаторов собирали годами — там только те, с кем работали сами.',
      },
      {
        title: 'Приезжаем на своей машине',
        text: 'В ней всегда есть печеньки и бутерброды.',
      },
      {
        title: 'С нами ненапряжно',
        text: 'Просто прикольные ребята, с которыми на съёмке комфортно и весело.',
      },
    ],
  },
];

// Пара снимает и фото, и видео — в обеих категориях стоит одна и та же
// карточка, поэтому и массив здесь один. Ключ добавляется автоматически
// по alsoCategories: заводить руками второй список — способ их рассинхронить.
// ============================================================
// ПОДРЯДЧИКИ ИЗ JSON — результат конвейера specialist-page
// (.claude/skills/specialist-page): файл src/data/specialists/<категория>/<slug>.json,
// фото в src/assets/specialists/<категория>/<slug>/, портрет в
// src/assets/specialists/<категория>/avatars/<slug>.webp. Формат — тот же
// Specialist; категория берётся из самого файла (categorySlug), папка —
// только для порядка. Новый файл = карточка в каталоге и визитка, код
// не трогаем. Позже эти JSON станут записями коллекции specialists.
// ============================================================
const jsonSpecialists = Object.values(
  import.meta.glob<Specialist>('./specialists/*/*.json', { eager: true, import: 'default' })
);

export const SPECIALISTS_BY_CATEGORY: Record<string, Specialist[]> = (() => {
  // Ведущие целиком из JSON: демо-набор на стоковых кадрах снят 18.09.2026,
  // в каталоге только реальные подрядчики.
  const map: Record<string, Specialist[]> = {
    fotografy: [...FOTOGRAFY],
  };
  for (const s of jsonSpecialists) (map[s.categorySlug] ??= []).push(s);

  for (const list of Object.values({ ...map })) {
    for (const s of list) {
      for (const extra of s.alsoCategories ?? []) {
        (map[extra] ??= []).push(s);
      }
    }
  }

  return map;
})();

/** ВСЕ ЖИВЫЕ КАРТОЧКИ ПОДРЯДЧИКОВ ОДНИМ СПИСКОМ — источник для общих
 *  потоков (доска главной). Дубли по slug сняты: карточка, стоящая в двух
 *  категориях (alsoCategories), — одна и та же карточка, и её кадры не
 *  должны попадать в ленту дважды. Демо-заглушки (demo: true) исключены
 *  намеренно: у них в photos стоковые кадры, и в ленте они выдавали бы
 *  чужую съёмку за работу конкретного подрядчика. */
export const REAL_SPECIALISTS: Specialist[] = (() => {
  const seen = new Set<string>();
  const out: Specialist[] = [];

  for (const list of Object.values(SPECIALISTS_BY_CATEGORY)) {
    for (const s of list) {
      if (s.demo || seen.has(s.slug)) continue;
      seen.add(s.slug);
      out.push(s);
    }
  }

  return out;
})();

export const FILTERS_BY_CATEGORY: Record<string, FilterGroup[]> = {
  vedushchie: VEDUSHCHIE_FILTERS,
  fotografy: FOTOGRAFY_FILTERS,
  // видеографы ищут по тем же параметрам съёмки, что и фотографы
  videografy: FOTOGRAFY_FILTERS,
  dekoratory: DEKORATORY_FILTERS,
};

/** карточка специалиста по slug — ищет во всех категориях сразу */
export function findSpecialist(slug: string): Specialist | undefined {
  for (const list of Object.values(SPECIALISTS_BY_CATEGORY)) {
    const found = list.find((s) => s.slug === slug);
    if (found) return found;
  }
  return undefined;
}

/** адрес визитки: она одна, даже если карточка стоит в двух категориях */
export function specialistUrl(s: Specialist): string {
  return `/moskva/podryadchiki/${s.categorySlug}/${s.slug}/`;
}
