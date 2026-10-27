// Анкета кабинета: разделы, их заполненность и форма данных карточки.
// Один источник для списка разделов (/profi/moi/kartochka/) и для экрана
// «Мои карточки». Что можно отправить на проверку, решает хук базы
// (pb_hooks/lib/cabinet.js, submitProblems) — здесь только подсказки
// человеку «что ещё не заполнено», без обещаний, которых сервер не держит.
//
// Данные карточки (revisions.data) — схема CABINET-UX.md §3:
//   firstName, lastName → name, tagline    — основное (подрядчик; name собирается сам)
//   address, rentFrom, checkFrom           — основное (площадка)
//   sections: [{ title, body }]            — текст разделами, как написан
//   filters: { ключ группы: значение | [значения] } — ответы на вопросы
//   tariffs: [{ name, price, includes }]   — пакеты прайса (подрядчик)
//   priceNote                              — от чего зависит цена
//   halls: [{ name, area, banquet, buffet, priceFrom, note }] — залы (площадка)
//   terms: { kitchen, alcohol, until, parking } — условия (площадка)
//   contacts: { phone (E.164), phoneCountry, telegram, max, site, email } — за кнопкой «Показать контакты»

export type Kind = 'venue' | 'specialist';
export type SectionKey = 'osnovnoe' | 'foto' | 'tekst' | 'voprosy' | 'prays' | 'zaly' | 'usloviya' | 'kontakty';

export interface Question {
  key: string;
  label: string;
  type: 'single' | 'multi';
  options: { value: string; label: string }[];
}

/** на проверку — от 8 фото, текст от 150 знаков (те же числа, что в хуке) */
export const MIN_PHOTOS = 8;
export const MAX_PHOTOS = 50;
export const MIN_TEXT = 150;

export const SECTIONS: Record<Kind, { key: SectionKey; title: string; icon: string }[]> = {
  specialist: [
    { key: 'osnovnoe', title: 'Основное', icon: 'profile' },
    { key: 'foto', title: 'Фото', icon: 'photo' },
    { key: 'tekst', title: 'Текст', icon: 'text' },
    { key: 'voprosy', title: 'Вопросы', icon: 'check' },
    { key: 'prays', title: 'Прайс', icon: 'notes' },
    { key: 'kontakty', title: 'Контакты', icon: 'phone' },
  ],
  venue: [
    { key: 'osnovnoe', title: 'Основное', icon: 'profile' },
    { key: 'foto', title: 'Фото', icon: 'photo' },
    { key: 'zaly', title: 'Залы', icon: 'catalog' },
    { key: 'usloviya', title: 'Условия', icon: 'notes' },
    { key: 'tekst', title: 'Текст', icon: 'text' },
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

export const rub = (n: number) => `${n.toLocaleString('ru-RU').replace(/ /g, ' ')} ₽`;

/** состояние раздела для строки списка: заполнен ли и что показать под названием */
export function sectionState(key: SectionKey, rev: any, questions: Question[]): { done: boolean; sub: string; empty?: boolean } {
  const d = rev?.data ?? {};
  const photos = (rev?.photos ?? []).length;
  switch (key) {
    case 'osnovnoe': {
      const done = filled(d.name) && (rev.kind === 'venue' ? filled(d.address) : true);
      return { done, sub: done ? [d.name, d.tagline || d.address].filter(Boolean).join(' · ') : 'пусто', empty: !done };
    }
    case 'foto':
      return { done: photos >= MIN_PHOTOS, sub: photos ? `${photos} из ${MAX_PHOTOS}${photos < MIN_PHOTOS ? ` · нужно от ${MIN_PHOTOS}` : ''}` : 'пусто · нужно от 8', empty: photos < MIN_PHOTOS };
    case 'tekst': {
      const n = (d.sections ?? []).filter((x: any) => str(x?.body)).length;
      const len = textLength(d);
      return { done: len >= MIN_TEXT, sub: n ? `${n} ${n === 1 ? 'раздел' : n < 5 ? 'раздела' : 'разделов'} · ${len} знаков` : 'пусто', empty: len < MIN_TEXT };
    }
    case 'voprosy': {
      if (!questions.length) return { done: true, sub: 'для этой категории вопросов нет' };
      const answered = questions.filter((q) => filled(d.filters?.[q.key])).length;
      return { done: answered === questions.length, sub: `${answered} из ${questions.length}`, empty: answered === 0 };
    }
    case 'prays': {
      const n = (d.tariffs ?? []).filter((t: any) => str(t?.name) && Number(t?.price) > 0).length;
      const p = priceFrom(d);
      // нужен хотя бы один пакет с ценой: одна приписка «ни от чего» проходила (прогон 27.10)
      return { done: n > 0, sub: n ? `${n} ${n === 1 ? 'пакет' : n < 5 ? 'пакета' : 'пакетов'} · от ${rub(p!)}` : 'нет пакета с ценой', empty: !n };
    }
    case 'zaly': {
      const halls = (d.halls ?? []).filter((h: any) => str(h?.name));
      const max = Math.max(0, ...halls.map((h: any) => Number(h?.banquet) || 0));
      return { done: halls.length > 0, sub: halls.length ? `${halls.length} ${halls.length === 1 ? 'зал' : halls.length < 5 ? 'зала' : 'залов'}${max ? ` · до ${max} гостей` : ''}` : 'пусто', empty: !halls.length };
    }
    case 'usloviya': {
      const t = d.terms ?? {};
      const done = filled(t.kitchen) && filled(t.alcohol);
      return { done, sub: done ? ['Кухня', 'алкоголь', t.until && 'время'].filter(Boolean).join(', ') : 'пусто', empty: !done };
    }
    case 'kontakty': {
      const c = d.contacts ?? {};
      const list = [c.phone && 'телефон', c.telegram && 'Telegram', c.max && 'MAX', c.site && 'сайт', c.email && 'почта'].filter(Boolean);
      return { done: filled(c.phone), sub: list.length ? list.join(', ') : 'пусто · нужен телефон', empty: !filled(c.phone) };
    }
  }
}

/** статус карточки одним словом и цветом (CLAUDE.md, «Кабинет — это не сайт») */
export function cardState(revStatus: string | undefined, live: boolean): { label: string; cls: string; note: string } {
  if (revStatus === 'rejected') return { label: 'Вернули', cls: 'c-badge--bad', note: 'нужно исправить' };
  if (revStatus === 'review') return { label: 'На проверке', cls: 'c-badge--info', note: live ? 'правка на проверке, на сайте прежняя версия' : 'проверим в течение суток' };
  if (revStatus === 'draft') return { label: 'Черновик', cls: '', note: live ? 'есть неотправленная правка' : 'заполняется' };
  if (live) return { label: 'На сайте', cls: 'c-badge--ok', note: 'опубликована' };
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
