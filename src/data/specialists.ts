// ============================================================
// КАТАЛОГ ПОДРЯДЧИКОВ — раздел «Специалисты».
// Начинаем с одной категории (Ведущие), чтобы отработать паттерн:
// фильтр слева + сетка карточек. Остальные 18 категорий подключаются
// тем же способом — свой набор FilterGroup[] и свой массив в SPECIALISTS.
// ============================================================
import { FILTERS_BY_CATEGORY as ALL_FILTERS } from './specialist-filters';

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
  /** РАЗДЕЛЫ ИСХОДНИКА (docs/CHARACTER.md, 08.10.2026): текст подрядчика его же
      структурой — какие разделы прислал, в каком порядке и каким голосом.
      Есть story — визитка выводит его вместо шаблона «О подрядчике /
      Почему выбирают / Что входит / Предложение»: раскладка по нашим
      ячейкам и теряла то, что в них не влезло. Это не каталог блоков:
      раздел — только текстовая форма (заголовок, абзацы, список, пункты
      с именем), набор и порядок переписываются из исходника. */
  story?: StorySection[];
  /** сколько фото в первом экране идёт до роликов (по умолчанию 1):
      заказчик задал «первую карусель» — LiRein, 6 кадров */
  leadPhotos?: number;
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
  /** свой цвет плашки, когда кадр снят не на бежевом и не на чернилах:
      у каждого раздела свой пыльный пастельный фон (лиловый у декоратора,
      розовый у кондитера), иначе десять обложек сливаются в одну. Хекс
      берётся с самого кадра — плитка обязана совпасть с ним тоном. */
  bg?: string;
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
    tone: 'beige',
    bg: '#b4c3d3',
  },
  {
    key: 'dekor',
    label: 'Декораторы',
    short: 'Декор',
    categories: ['dekoratory'],
    cover: '/specialists/groups/dekor.webp',
    tone: 'beige',
    bg: '#c6b0c0',
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
    label: 'Кейтеринг и кондитерка',
    short: 'Кейтеринг',
    categories: ['keitering', 'konditery'],
    cover: '/specialists/groups/kuhnya.webp',
    tone: 'beige',
    bg: '#c8a69f',
  },
  {
    key: 'obraz',
    label: 'Стилисты и визажисты',
    short: 'Образ',
    categories: ['stilisty'],
    cover: '/specialists/groups/obraz.webp',
    tone: 'beige',
    bg: '#d9b49c',
  },
  {
    key: 'muzyka',
    label: 'Музыка и вокал',
    short: 'Музыка',
    categories: ['dj', 'kaver-gruppy', 'vokalisty', 'muzykanty'],
    cover: '/specialists/groups/muzyka.webp',
    tone: 'beige',
    bg: '#b59ea7',
  },
  {
    key: 'oborudovanie',
    label: 'Оборудование и спецэффекты',
    short: 'Оборудование',
    categories: ['speceffekty', 'arenda-zvuka', 'arenda-sveta'],
    cover: '/specialists/groups/oborudovanie.webp',
    tone: 'dark',
    bg: '#73958a',
  },
  {
    key: 'shou',
    label: 'Шоу и развлечения',
    short: 'Шоу',
    categories: ['horeografy', 'animatory', 'shou', 'fokusniki'],
    cover: '/specialists/groups/shou.webp',
    tone: 'beige',
    bg: '#dcc7a5',
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

// Фильтры категорий (VEDUSHCHIE_FILTERS, FOTOGRAFY_FILTERS, DEKORATORY_FILTERS
// и остальные) живут в data/specialist-filters.ts — там же, откуда
// собирается таблица-реестр модератора. Здесь только реэкспорт.
export { VEDUSHCHIE_FILTERS, FOTOGRAFY_FILTERS, DEKORATORY_FILTERS } from './specialist-filters';

// ============ КАРТОЧКИ: ФОТОГРАФЫ ============
// ПЕРВЫЙ РЕАЛЬНЫЙ ПОДРЯДЧИК КАТАЛОГА (не демо): Лешаковы, фото и видео.
// Тексты — их собственные, слегка причёсанные; ничего не дописано за них.
// Чего у нас пока НЕТ и что нельзя выдумывать — оставлено пустым, такая
// карточка просто не попадает в соответствующий фильтр:
//   рейтинг и отзывы (ни одного собранного),
//   сроки и формат выдачи, договор, предоплата, минимальный бюджет.
// Спросить у подрядчика и заполнить — тогда карточка встанет в эти фильтры.

// Лешаковы (единственная карточка, записанная прямо в коде) переехали в
// specialists/fotografy/leshakovy.json и в базу — 05.11.2026: база — единственный
// источник карточек, правка в коде больше не нужна.

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
// Карточки из кабинета подрядчика: кладёт scripts/pb-pull-cabinet.mjs
// перед сборкой на раннере деплоя, папка в .gitignore (в git их нет).
// Карточка, которую владелец получил по приглашению и поправил в кабинете,
// есть и в git (конвейер), и здесь: кабинет — источник правды (решение
// 20.10), его версия заменяет файл из git, а не встаёт второй копией.
const withLabel = (s: Specialist): Specialist => ({ ...s, category: SPECIALIST_CATEGORIES.find((c) => c.slug === s.categorySlug)?.label ?? s.categorySlug });
const cabinetSpecialists = Object.values(
  import.meta.glob<Specialist>('./cabinet/specialists/*.json', { eager: true, import: 'default' })
).map(withLabel);
const fromCabinet = new Set(cabinetSpecialists.map((s) => `${s.categorySlug}/${s.slug}`));
/** карточка из кабинета: визитку рисует сервер из базы (сайт из базы, этап 1) */
export const isFromCabinet = (s: Pick<Specialist, 'categorySlug' | 'slug'>) => fromCabinet.has(`${s.categorySlug}/${s.slug}`);

// Карточки «ведём мы» (пилот, 03.11, docs/cabinet/CABINET.md §24): визитка — наш JSON
// из git, а цену и ответы на вопросы владелец правит сам в кабинете.
// Одобренные правки кладёт scripts/pb-pull-cabinet.mjs (owner-edits.json,
// в .gitignore); здесь они ложатся поверх JSON. Нет файла — JSON как есть.
// 07.11: + строка под именем, «Коротко о себе» (первый абзац текста) и
// портрет — их владелец «ведём мы» тоже ставит сам (хук approveManaged).
// avatar — имя файла в базе; адрес из него собирает lib/live-data.ts.
type OwnerEdits = {
  priceMode?: string; priceFrom?: number | null; priceNote?: string; filters?: Record<string, string | string[]>;
  tagline?: string; intro?: string; avatar?: string;
  /** цены тарифов из текста визитки, по названию тарифа (09.11) */
  tariffPrices?: { name: string; price: number }[];
};

/** цены владельца в тарифах визитки: меняется только число, по названию тарифа (09.11) */
function withTariffPrices(story: Specialist['story'], prices: { name: string; price: number }[]): Specialist['story'] {
  const by = new Map(prices.filter((p) => p?.name && Number(p.price) > 0).map((p) => [p.name, Number(p.price)]));
  if (!by.size || !story) return story;
  const rub = (n: number) => `${n.toLocaleString('ru-RU').replace(/\s/g, ' ')} ₽`;
  return story.map((sec) => (sec.tariffs?.length
    ? { ...sec, tariffs: sec.tariffs.map((t) => (by.has(t.name) ? { ...t, price: rub(by.get(t.name)!) } : t)) }
    : sec));
}

/** «Коротко о себе» владельца — на место первого абзаца текста визитки
 *  (того же, что кабинет показывает ему в поле: крупная фраза или первый абзац) */
function withIntro(s: Specialist, intro: string): Pick<Specialist, 'story' | 'bio'> {
  if (s.story?.length) {
    const [first, ...rest] = s.story;
    const sec = { ...first };
    if (sec.lead) sec.lead = intro;
    else sec.text = [intro, ...(sec.text ?? []).slice(1)];
    return { story: [sec, ...rest], bio: s.bio };
  }
  // карточка старого формата: текст в bio
  const paras = String(s.bio ?? '').split(/\n\s*\n/);
  return { story: s.story, bio: [intro, ...paras.slice(1)].filter(Boolean).join('\n\n') };
}
let ownerEdits: Record<string, OwnerEdits> =
  Object.values(import.meta.glob<Record<string, OwnerEdits>>('./cabinet/owner-edits.json', { eager: true, import: 'default' }))[0] ?? {};

/** ответы на вопросы дублируются плоскими полями (каталог, сравнение, «Похожие») — сводим их к новым ответам */
function withOwnerEdits(s: Specialist): Specialist {
  const e = ownerEdits[`${s.categorySlug}/${s.slug}`];
  if (!e) return s;
  const out: Specialist = { ...s, priceNote: e.priceNote ?? s.priceNote };
  if (e.tagline?.trim()) out.tagline = e.tagline.trim();
  if (e.intro?.trim()) Object.assign(out, withIntro(s, e.intro.trim()));
  if (e.tariffPrices?.length) out.story = withTariffPrices(out.story, e.tariffPrices);
  if (e.priceFrom && e.priceFrom > 0) out.priceFrom = e.priceFrom;
  else delete out.priceFrom; // «по запросу»
  if (e.filters) {
    const f = e.filters;
    const list = (v: unknown) => ([] as string[]).concat((v as string[]) ?? []);
    const one = (v: unknown) => (Array.isArray(v) ? v[0] : v) as string | undefined;
    out.filters = f;
    if ('gender' in f) out.gender = one(f.gender) as Specialist['gender'];
    if ('city' in f) out.cities = list(f.city);
    if ('style' in f) out.styles = list(f.style);
    if ('age' in f) out.age = one(f.age) as Specialist['age'];
    if ('formats' in f) out.formats = list(f.formats);
    if ('languages' in f) out.languages = list(f.languages);
    if ('ownDJ' in f) out.hasOwnDJ = one(f.ownDJ) === 'yes';
    if ('ceremonyMaster' in f) out.ceremonyMaster = one(f.ceremonyMaster) === 'yes';
    if ('equipment' in f) out.hasEquipment = one(f.equipment) === 'yes';
    // стаж числом нам известен только для прежнего ответа
    if (f.experience !== s.filters?.experience) delete out.experienceYears;
  }
  return out;
}

// Наши карточки из git (конвейер specialist-page) — основа каталога.
const GIT_SPECIALISTS = Object.values(
  import.meta.glob<Specialist>('./specialists/*/*.json', { eager: true, import: 'default' })
);

/** git + правки владельцев «ведём мы» + карточки из кабинета (кабинет главнее git) */
function compose(cabinet: Specialist[]): Specialist[] {
  return GIT_SPECIALISTS
    .filter((s) => !fromCabinet.has(`${s.categorySlug}/${s.slug}`))
    .map(withOwnerEdits)
    .concat(cabinet);
}

function group(list: Specialist[]): Record<string, Specialist[]> {
  // Ведущие целиком из JSON: демо-набор на стоковых кадрах снят 18.09.2026,
  // в каталоге только реальные подрядчики.
  const map: Record<string, Specialist[]> = {};
  for (const s of list) (map[s.categorySlug] ??= []).push(s);

  // снимок списков: пока своей категории не было, «Видеографы» собирались
  // только из alsoCategories; с первым JSON-видеографом цикл стал дописывать
  // в тот же массив, по которому идёт, и уходил в бесконечность
  for (const l of Object.values(map).map((x) => [...x])) {
    for (const s of l) {
      for (const extra of s.alsoCategories ?? []) {
        (map[extra] ??= []).push(s);
      }
    }
  }
  return map;
}

/** ВСЕ ЖИВЫЕ КАРТОЧКИ ПОДРЯДЧИКОВ ОДНИМ СПИСКОМ — источник для общих
 *  потоков (доска главной). Дубли по slug сняты: карточка, стоящая в двух
 *  категориях (alsoCategories), — одна и та же карточка, и её кадры не
 *  должны попадать в ленту дважды. Демо-заглушки (demo: true) исключены
 *  намеренно: у них в photos стоковые кадры, и в ленте они выдавали бы
 *  чужую съёмку за работу конкретного подрядчика. */
function realOf(map: Record<string, Specialist[]>): Specialist[] {
  const seen = new Set<string>();
  const out: Specialist[] = [];
  for (const l of Object.values(map)) {
    for (const s of l) {
      if (s.demo || seen.has(s.slug)) continue;
      seen.add(s.slug);
      out.push(s);
    }
  }
  return out;
}

export const SPECIALISTS_BY_CATEGORY: Record<string, Specialist[]> = group(compose(cabinetSpecialists));
export const REAL_SPECIALISTS: Specialist[] = realOf(SPECIALISTS_BY_CATEGORY);

/**
 * САЙТ ИЗ БАЗЫ (этап 2, 05.11.2026): страницы, которые рисует сервер, перед
 * показом подставляют живые данные базы — карточки из кабинета и правки
 * владельцев. Таблицы обновляются НА МЕСТЕ: их читают каталоги, «Похожие»,
 * навигация, счётчики — и все они видят свежее без своей логики загрузки.
 * Зовёт lib/live-data.ts (refreshLive), не страницы напрямую.
 */
export function applyLive(cards: Specialist[], edits: Record<string, OwnerEdits>, cabinetKeys: string[]) {
  // этап 3 (05.11.2026): база — единственный источник карточек подрядчиков,
  // git — только запасной вариант при старте службы (до первой загрузки)
  ownerEdits = edits;
  fromCabinet.clear();
  for (const k of cabinetKeys) fromCabinet.add(k);
  const map = group(cards.map(withLabel).map(withOwnerEdits));
  for (const k of Object.keys(SPECIALISTS_BY_CATEGORY)) delete SPECIALISTS_BY_CATEGORY[k];
  Object.assign(SPECIALISTS_BY_CATEGORY, map);
  REAL_SPECIALISTS.length = 0;
  REAL_SPECIALISTS.push(...realOf(map));
}
export type { OwnerEdits };

// Остальные категории (и видеографы со своим набором) — из документов
// заказчика «Основные фильтры для …», см. data/specialist-filters.ts.
// Категория без набора (шоу) фильтров не получает — страница это умеет.
export const FILTERS_BY_CATEGORY: Record<string, FilterGroup[]> = ALL_FILTERS;

/** карточка специалиста по slug — ищет во всех категориях сразу */
export function findSpecialist(slug: string): Specialist | undefined {
  for (const list of Object.values(SPECIALISTS_BY_CATEGORY)) {
    const found = list.find((s) => s.slug === slug);
    if (found) return found;
  }
  return undefined;
}

/** Есть ли у карточки своя страница-визитка: она собирается только тем,
 *  кто дал материал — предложение или список причин. Одно условие на
 *  getStaticPaths визитки и на все места, которые на визитку ссылаются
 *  («похожие подрядчики»): иначе ссылка ведёт в 404. */
export function hasProfile(s: Specialist): boolean {
  return Boolean(s.quote || s.offers || s.story?.length);
}

/** Раздел текста подрядчика (поле story). Порядок полей внутри раздела —
 *  порядок вывода: заголовок → крупная фраза → абзацы → список → пункты →
 *  абзацы после. */
export interface StorySection {
  /** заголовок раздела, если он есть у подрядчика («Как проходит работа») */
  title?: string;
  /** абзацы до списка */
  text?: string[];
  /** перечисление — буллитом, слова подрядчика */
  list?: string[];
  /** короткие факты россыпью плашек .plates («о себе», список интерактивов):
      когда пунктов много и они в одну-две строки, столбец буллитов тянется */
  tiles?: string[];
  /** пункты с собственным именем (участники группы, позиции прайса): имя — h3;
      photo — портрет в кружке слева (участники группы) */
  items?: { title: string; text?: string; list?: string[]; photo?: string }[];
  /** тарифы карточками: шапка «название — цена», что входит, примечание.
      Всё, что относится к тарифу, — внутри него, а не абзацем между тарифами */
  tariffs?: { name: string; price: string; unit?: string; lead?: string; includes?: string[]; note?: string }[];
  /** цифры-факты («15+ лет», «700+ торжеств») — крупное число и подпись,
      той же полосой StatsStrip, что цифры площадки (заказчик, 14.10.2026) */
  stats?: { value: string; label: string }[];
  /** абзацы после списка/пунктов («Также у нас есть…») */
  after?: string[];
  /** короткая фраза, которую подрядчик сам ставит отдельно (премия,
      девиз) — крупным кеглем, а не жирным внутри абзаца */
  lead?: string;
  /** вид раздела: 'menu' — пункты как меню кейтеринга (одна плашка,
      блюдо жирным, состав мелко) */
  kind?: 'menu';
  /** 'dark' — раздел на шоколаде (.theme-dark), как тёмный блок площадки:
      главная фраза автора; один-два на страницу */
  tone?: 'dark';
  /** кадр после раздела, который заказчик поставил сам (команда, работа):
      если он есть хоть у одного раздела — автоматические паузы из photos
      не ставятся, порядок кадров в тексте целиком задают данные */
  photo?: string;
}

/** адрес визитки: она одна, даже если карточка стоит в двух категориях */
export function specialistUrl(s: Specialist): string {
  return `/moskva/podryadchiki/${s.categorySlug}/${s.slug}/`;
}
