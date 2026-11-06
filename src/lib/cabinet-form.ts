import { plural } from './plural';
// Анкета кабинета: разделы, их заполненность и форма данных карточки.
// Один источник для списка разделов (/profi/moi/kartochka/) и для экрана
// «Мои карточки». Что можно отправить на проверку, решает хук базы
// (pb_hooks/lib/cabinet.js, submitProblems) — здесь только подсказки
// человеку «что ещё не заполнено», без обещаний, которых сервер не держит.
//
// Данные карточки (revisions.data) — схема docs/cabinet/CABINET-UX.md §3:
//   firstName, lastName → name, tagline    — основное (подрядчик; name собирается сам)
//   address, rentFrom, checkFrom           — основное (площадка)
//   sections: [{ title, body }]            — текст разделами, как написан
//   filters: { ключ группы: значение | [значения] } — ответы на вопросы
//   priceMode: one | tariffs | request   — как считают цену (подрядчик)
//   priceFrom, priceNote                   — «от N ₽» и «за что» (одна цена; у тарифов — от самого дешёвого)
//   tariffs: [{ name, price, unit, includes }] — тарифы
//   halls: [{ name, area, banquet, buffet, priceFrom, note }] — залы (площадка)
//   terms: { kitchen, alcohol, until, parking } — условия (площадка)
//   videos: [{ url }]                      — ссылки на ролики (диск, YouTube…), ролик готовим мы (docs/VIDEO.md)
//   contacts: { phone (E.164), phoneCountry, telegram, max, site, email } — за кнопкой «Показать контакты»

export type Kind = 'venue' | 'specialist';
export type SectionKey = 'osnovnoe' | 'foto' | 'video' | 'tekst' | 'voprosy' | 'prays' | 'zaly' | 'usloviya' | 'kontakty';

export interface Question {
  key: string;
  label: string;
  type: 'single' | 'multi';
  options: { value: string; label: string }[];
}

/** ссылок на видео в одной карточке */
export const MAX_VIDEOS = 5;
/** тарифов в разделе «Цена» — не больше (Никита 05.11: больше пара не сравнит) */
export const MAX_TARIFFS = 5;

/** на проверку — от 8 фото, текст от 150 знаков (те же числа, что в хуке) */
export const MIN_PHOTOS = 8;
export const MAX_PHOTOS = 50;
export const MIN_TEXT = 150;
/** карточек на одну учётку — то же число в хуке (pb/pb_hooks/lib/cabinet.js, MAX_CARDS) */
export const MAX_CARDS = 3;

/** optional — раздел по желанию: пустым не краснеет и в полосу заполненности не входит */
export const SECTIONS: Record<Kind, { key: SectionKey; title: string; icon: string; optional?: boolean }[]> = {
  specialist: [
    { key: 'osnovnoe', title: 'Основное', icon: 'profile' },
    { key: 'foto', title: 'Фото', icon: 'photo' },
    { key: 'video', title: 'Видео', icon: 'video', optional: true },
    { key: 'tekst', title: 'Описание', icon: 'text' },
    { key: 'voprosy', title: 'Вопросы', icon: 'check' },
    { key: 'prays', title: 'Цена', icon: 'notes' },
    { key: 'kontakty', title: 'Контакты', icon: 'phone' },
  ],
  venue: [
    { key: 'osnovnoe', title: 'Основное', icon: 'profile' },
    { key: 'foto', title: 'Фото', icon: 'photo' },
    { key: 'video', title: 'Видео', icon: 'video', optional: true },
    { key: 'zaly', title: 'Залы', icon: 'catalog' },
    { key: 'usloviya', title: 'Условия', icon: 'notes' },
    { key: 'tekst', title: 'Описание', icon: 'text' },
    { key: 'voprosy', title: 'Вопросы', icon: 'check' },
    { key: 'kontakty', title: 'Контакты', icon: 'phone' },
  ],
};

// Вопросы площадки — те же значения, что у полей коллекции venues
// (pb_migrations/1757700000_init_catalog.js): хук при одобрении кладёт
// ответы в фильтры каталога площадок.
export const VENUE_QUESTIONS: Question[] = [
  {
    key: 'type', label: 'Тип площадки', type: 'single', options: [
      { value: 'restoran', label: 'Ресторан' }, { value: 'banketnyj-zal', label: 'Банкетный зал' },
      { value: 'shater', label: 'Шатёр' }, { value: 'veranda', label: 'Веранда' },
      { value: 'restoran-pri-otele', label: 'Ресторан при отеле' }, { value: 'zagorodnyj-klub', label: 'Загородный клуб' },
      { value: 'loft', label: 'Лофт' }, { value: 'oranzhereya', label: 'Оранжерея' }, { value: 'usadba', label: 'Усадьба' },
      { value: 'yaht-klub', label: 'Яхт-клуб' }, { value: 'drugoe', label: 'Другое' },
    ],
  },
  {
    key: 'districts', label: 'Где находитесь', type: 'multi', options: [
      { value: 'cao', label: 'ЦАО' }, { value: 'sao', label: 'САО' }, { value: 'svao', label: 'СВАО' }, { value: 'vao', label: 'ВАО' },
      { value: 'yuvao', label: 'ЮВАО' }, { value: 'yuao', label: 'ЮАО' }, { value: 'yuzao', label: 'ЮЗАО' }, { value: 'zao', label: 'ЗАО' },
      { value: 'szao', label: 'СЗАО' }, { value: 'podmoskovie', label: 'Подмосковье' },
    ],
  },
  {
    key: 'purposes', label: 'Для чего подходит', type: 'multi', options: [
      { value: 'svadba', label: 'Свадьба' }, { value: 'korporativ', label: 'Корпоратив' },
      { value: 'den-rozhdeniya', label: 'День рождения' }, { value: 'furshet', label: 'Фуршет' },
    ],
  },
  {
    key: 'features', label: 'Что есть', type: 'multi', options: [
      { value: 'u-vody', label: 'У воды' }, { value: 'vyezdnaya-registraciya', label: 'Выездная регистрация' },
      { value: 'za-gorodom', label: 'За городом' }, { value: 'pod-zakrytie', label: 'Под закрытие' },
      { value: 'prozhivanie', label: 'Проживание' }, { value: 'parkovka', label: 'Парковка' }, { value: 'terrasa', label: 'Терраса' },
    ],
  },
];

/** условия площадки: варианты, на которые ответить быстрее, чем написать */
export const VENUE_TERMS: Question[] = [
  {
    key: 'kitchen', label: 'Кухня', type: 'single', options: [
      { value: 'own', label: 'Только наша' }, { value: 'catering', label: 'Можно свой кейтеринг' }, { value: 'both', label: 'И то и другое' },
    ],
  },
  {
    key: 'alcohol', label: 'Свой алкоголь', type: 'single', options: [
      { value: 'free', label: 'Без сбора' }, { value: 'fee', label: 'Со сбором' }, { value: 'no', label: 'Нельзя' },
    ],
  },
];

const str = (v: unknown) => String(v ?? '').trim();
const filled = (v: unknown) => (Array.isArray(v) ? v.length > 0 : str(v) !== '');

export function textLength(data: any): number {
  const sections: any[] = Array.isArray(data.sections) ? data.sections : [];
  const n = sections.reduce((s, x) => s + str(x?.body).replace(/\s+/g, ' ').length, 0);
  return Math.max(n, str(data.about).length);
}

export function priceFrom(data: any): number | null {
  const prices = (Array.isArray(data.tariffs) ? data.tariffs : [])
    .map((t: any) => Number(String(t?.price ?? '').replace(/\s/g, '')))
    .filter((p: number) => p > 0);
  if (prices.length) return Math.min(...prices);
  const own = Number(String(data.priceFrom ?? data.rentFrom ?? '').replace(/\s/g, ''));
  return own > 0 ? own : null;
}

/**
 * Число с разрядами и единицей — ОДНА функция на кабинет и админку (правило 24
 * скилла cabinet-ui). Все пробелы неразрывные: и между разрядами, и перед
 * единицей, иначе «12 000 ₽» рвётся посреди числа на узком экране. Раньше здесь
 * неразрывный пробел меняли на обычный, а в модерации жили ещё две копии.
 */
export const NBSP = ' ';
export const num = (n: number) => n.toLocaleString('ru-RU').replace(/\s/g, NBSP);
export const rub = (n: number) => `${num(n)}${NBSP}₽`;

/** состояние раздела для строки списка: заполнен ли и что показать под названием */
export function sectionState(key: SectionKey, rev: any, questions: Question[]): { done: boolean; sub: string; empty?: boolean } {
  const d = rev?.data ?? {};
  const photos = (rev?.photos ?? []).length;
  switch (key) {
    case 'osnovnoe': {
      const done = meaningfulName(d.name) && (rev.kind === 'venue' ? filled(d.address) : true);
      return { done, sub: done ? [d.name, d.tagline || d.address].filter(Boolean).join(', ') : 'пусто', empty: !done };
    }
    case 'foto':
      return { done: photos >= MIN_PHOTOS, sub: photos ? `${photos}${NBSP}из ${MAX_PHOTOS}${photos < MIN_PHOTOS ? `, нужно от${NBSP}${MIN_PHOTOS}` : ''}` : `пусто, нужно от${NBSP}${MIN_PHOTOS}`, empty: photos < MIN_PHOTOS };
    case 'video': {
      const n = (d.videos ?? []).filter((v: any) => str(v?.url)).length;
      return { done: n > 0, sub: n ? `${n} ${n === 1 ? 'ссылка' : n < 5 ? 'ссылки' : 'ссылок'}` : 'по желанию' };
    }
    case 'tekst': {
      const n = (d.sections ?? []).filter((x: any) => str(x?.body)).length;
      const len = textLength(d);
      return { done: len >= MIN_TEXT, sub: n ? `${n} ${n === 1 ? 'раздел' : n < 5 ? 'раздела' : 'разделов'}, ${num(len)}${NBSP}знаков` : 'пусто', empty: len < MIN_TEXT };
    }
    case 'voprosy': {
      if (!questions.length) return { done: true, sub: 'для этой категории вопросов нет' };
      const answered = questions.filter((q) => filled(d.filters?.[q.key])).length;
      return { done: answered === questions.length, sub: `${answered} из ${questions.length}`, empty: answered === 0 };
    }
    case 'prays': {
      // три способа (разбор цен 27.10): одна цена «от … за что», тарифы, по запросу
      const p = priceFrom(d);
      const mode = d.priceMode ?? ((d.tariffs ?? []).length ? 'tariffs' : 'one');
      if (mode === 'request') return { done: true, sub: 'по запросу' };
      if (mode === 'tariffs') {
        const n = (d.tariffs ?? []).filter((t: any) => str(t?.name) && Number(t?.price) > 0).length;
        return { done: n > 0, sub: n ? `${n} ${n === 1 ? 'тариф' : n < 5 ? 'тарифа' : 'тарифов'}, от ${rub(p!)}` : 'нет тарифа с ценой', empty: !n };
      }
      return { done: !!p, sub: p ? `от ${rub(p)}${str(d.priceNote) ? ` ${str(d.priceNote)}` : ''}` : 'пусто', empty: !p };
    }
    case 'zaly': {
      const halls = (d.halls ?? []).filter((h: any) => str(h?.name));
      const max = Math.max(0, ...halls.map((h: any) => Number(h?.banquet) || 0));
      return { done: halls.length > 0, sub: halls.length ? `${halls.length} ${halls.length === 1 ? 'зал' : halls.length < 5 ? 'зала' : 'залов'}${max ? `, до ${max} гостей` : ''}` : 'пусто', empty: !halls.length };
    }
    case 'usloviya': {
      const t = d.terms ?? {};
      const done = filled(t.kitchen) && filled(t.alcohol);
      return { done, sub: done ? ['Кухня', 'алкоголь', t.until && 'время'].filter(Boolean).join(', ') : 'пусто', empty: !done };
    }
    case 'kontakty': {
      const c = d.contacts ?? {};
      const list = [c.phone && 'телефон', c.telegram && 'Telegram', c.max && 'MAX', c.site && 'сайт', c.email && 'почта'].filter(Boolean);
      return { done: filled(c.phone), sub: list.length ? list.join(', ') : 'пусто, нужен телефон', empty: !filled(c.phone) };
    }
  }
}

/**
 * Что сделать, чтобы раздел засчитался, — конкретно, с числами (Никита,
 * 05.11: «осталось два раздела: фото и цена» — неинформативно). Строка
 * продолжает название раздела: «Фото — добавьте ещё 5, сейчас 3 из 8».
 */
export function sectionTodo(key: SectionKey, rev: any, questions: Question[]): string {
  const d = rev?.data ?? {};
  switch (key) {
    case 'osnovnoe':
      return [!filled(d.name) ? 'впишите имя или название' : !meaningfulName(d.name) && 'проверьте имя — похоже на случайные буквы', rev.kind === 'venue' && !filled(d.address) && 'укажите адрес'].filter(Boolean).join(' и ');
    case 'foto': {
      const n = (rev?.photos ?? []).length;
      return `добавьте ещё ${MIN_PHOTOS - n}, сейчас ${n}${NBSP}из ${MIN_PHOTOS}`;
    }
    case 'tekst': {
      const len = textLength(d);
      return len ? `допишите ещё ${num(MIN_TEXT - len)}${NBSP}знаков, нужно от${NBSP}${MIN_TEXT}` : `расскажите о себе, от${NBSP}${MIN_TEXT} знаков`;
    }
    case 'voprosy': {
      const left = questions.filter((q) => !filled(d.filters?.[q.key])).length;
      // «ответьте ещё на 8 из 8» — и коряво, и «8» падала на строку одна (Никита 06.11)
      return left === questions.length ? `ответьте на${NBSP}${left}${NBSP}${plural(left, ['вопрос', 'вопроса', 'вопросов'])}` : `осталось ответить на${NBSP}${left}${NBSP}из${NBSP}${questions.length}`;
    }
    case 'prays':
      return (d.priceMode ?? ((d.tariffs ?? []).length ? 'tariffs' : 'one')) === 'tariffs'
        ? 'у тарифа нет названия или цены — впишите сумму'
        : 'впишите цену «от» — или выберите «по запросу»';
    case 'zaly':
      return 'добавьте хотя бы один зал с названием';
    case 'usloviya':
      return 'ответьте про кухню и свой алкоголь';
    case 'kontakty':
      return 'укажите телефон — без него пара не свяжется';
    default:
      return 'заполните раздел';
  }
}

/**
 * «Цена за …» — варианты под категорию (Никита 05.11: фотографу предлагали
 * «за кг»). Нет категории в списке — общий набор.
 */
const UNITS_TIME = ['за час', 'за 6 часов', 'за день', 'за проект'];
export const PRICE_UNITS_BY_CAT: Record<string, string[]> = {
  fotografy: UNITS_TIME, videografy: UNITS_TIME, 'rils-meikery': ['за час', 'за день', 'за ролик'],
  vedushchie: ['за вечер', 'за час', 'за проект'], dj: ['за вечер', 'за час'], 'kaver-gruppy': ['за вечер', 'за сет', 'за час'],
  vokalisty: ['за вечер', 'за сет', 'за песню'], muzykanty: ['за вечер', 'за сет', 'за час'],
  organizatory: ['за проект', 'за день'], koordinatory: ['за день', 'за проект'], dekoratory: ['за проект', 'за гостя'],
  keitering: ['за гостя', 'за проект'], konditery: ['за кг', 'за торт'], stilisty: ['за образ', 'за выезд', 'за час'],
  speceffekty: ['за шоу', 'за проект'], 'arenda-zvuka': ['за день', 'за вечер'], 'arenda-sveta': ['за день', 'за вечер'],
  horeografy: ['за урок', 'за постановку'], animatory: ['за час', 'за программу'], shou: ['за шоу', 'за номер'],
  fokusniki: ['за выступление', 'за час'], avto: ['за час', 'за день', 'за трансфер'],
  _venue: ['за гостя', 'за день', 'за час'], _default: ['за час', 'за день', 'за проект'],
};
export const priceUnits = (kind: string, cat: string) => PRICE_UNITS_BY_CAT[kind === 'venue' ? '_venue' : cat] ?? PRICE_UNITS_BY_CAT._default;

/**
 * Осмысленное имя: каждое слово от 2 букв и не из одной повторённой буквы
 * (Никита 05.11: «Ааа ббб» получало галочку).
 */
export function meaningfulName(v: unknown): boolean {
  const words = String(v ?? '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return false;
  return words.every((w) => w.length >= 2 && !/^(.)\1+$/i.test(w));
}

/** статус карточки одним словом и цветом (CLAUDE.md, «Кабинет — это не сайт») */
export function cardState(revStatus: string | undefined, live: boolean): { label: string; cls: string; note: string } {
  if (revStatus === 'rejected') return { label: 'Вернули', cls: 'status--bad', note: 'нужно исправить' };
  if (revStatus === 'review') return { label: 'На проверке', cls: 'status--info', note: live ? 'правка на проверке, на сайте прежняя версия' : 'проверим в течение 24 часов' };
  if (revStatus === 'draft') return { label: 'Черновик', cls: '', note: live ? 'есть неотправленная правка' : 'заполняется' };
  if (live) return { label: 'На сайте', cls: 'status--ok', note: 'опубликована' };
  return { label: 'Снята с сайта', cls: '', note: 'сейчас её нет на сайте — напишите нам' };
}

/**
 * Кадр с телефона перед загрузкой: длинная сторона до 3000 px (CLAUDE.md:
 * «материал, а не результат» — 2400–3000 px, качество высокое). Оригиналы
 * по 3–10 МБ упирались в лимит запроса (прогон 26.10) и ехали по сотовой сети
 * дольше, чем нужно. Маленький кадр уходит как есть, без пережатия.
 */
export async function shrinkPhoto(file: File): Promise<File> {
  const MAX_SIDE = 3000;
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  try {
    const bmp = await createImageBitmap(file);
    const side = Math.max(bmp.width, bmp.height);
    if (side <= MAX_SIDE && file.size <= 8 * 1024 * 1024) { bmp.close(); return file; }
    const k = Math.min(1, MAX_SIDE / side);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * k);
    canvas.height = Math.round(bmp.height * k);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.9));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
