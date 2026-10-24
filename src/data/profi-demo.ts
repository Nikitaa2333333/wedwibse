// ЗАГЛУШКА для прототипа кабинета подрядчика (STAGE2.md §0.1). Вживую
// эти данные придут из базы: учётка — `vendors`, карточки — `specialists`/
// `venues` + черновики `revisions` (pb/pb_migrations/1759600000_cabinet.js).
// Типы ниже — набросок того, что экран кабинета будет читать из базы.

export type CardStatus = 'draft' | 'review' | 'returned' | 'published';

export const STATUS_LABEL: Record<CardStatus, string> = {
  draft: 'Черновик',
  review: 'На проверке',
  returned: 'Вернули с причиной',
  published: 'На сайте',
};

export interface CabinetCard {
  /** путь к фото в src/assets — проходит через resolveImage */
  photo?: string;
  name: string;
  role: string;
  status: CardStatus;
  /** строка под статусом: что происходит и что делать */
  note: string;
  /** адрес страницы на сайте (у опубликованной) */
  url?: string;
  /** сколько из анкеты заполнено, 0–100 */
  filled: number;
  /** у опубликованной: правка ждёт модератора, на сайте прежняя версия */
  pending?: string;
  /** у возвращённой: причина словами модератора */
  reason?: string;
}

export const DEMO_ACCOUNT = {
  name: 'Алексей',
  cardsMax: 3,
};

export const DEMO_CARDS: CabinetCard[] = [
  {
    photo: '/specialists/fotografy/suhorada/gal/p09.webp',
    name: 'Алексей Сухорада',
    role: 'Фотограф',
    status: 'published',
    note: 'На сайте с 18 октября · правка на проверке с 12:04',
    url: '/moskva/podryadchiki/fotografy/suhorada/',
    filled: 100,
    pending: 'Новые фото и цены на проверке — на сайте пока прежняя версия',
  },
  {
    name: 'Алексей Сухорада',
    role: 'Видеограф',
    status: 'returned',
    note: 'Вернули 19 октября: в тексте телефон',
    filled: 80,
    reason: 'В тексте указан телефон. Контакты — только в разделе «Контакты».',
  },
];

// «Интерес» — что пары делают с карточкой (STAGE2.md §1, без денег).
// Только честные цифры, у каждой — источник. Пока подсчёт не подключён,
// показываем «нет данных», а не выдуманные числа (Никита, 24.10.2026).
// Вживую: просмотры — API Яндекс Метрики по адресу страницы карточки;
// избранное и открытия контактов — считает наш сервер (CABINET.md §18).
export interface InterestMetric {
  key: 'views' | 'saves' | 'contacts';
  label: string;
  /** откуда берётся цифра — подрядчику, простыми словами */
  source: string;
  /** null — подсчёт ещё не подключён */
  value: number | null;
}

export const INTEREST_METRICS: InterestMetric[] = [
  { key: 'views', label: 'Просмотры карточки', source: 'По данным Яндекс Метрики — сколько раз открыли вашу страницу', value: null },
  { key: 'saves', label: 'Сохранили в избранное', source: 'Считает наш сервер — когда пара нажимает сердце на карточке', value: null },
  { key: 'contacts', label: 'Открыли контакты', source: 'Считает наш сервер — когда пара нажимает «Показать контакты»', value: null },
];

// Разделы анкеты подрядчика и их состояние — то, что хаб анкеты показывает
// строками (CABINET-UX.md §2 п.3). Вживую считается из данных ревизии.
export interface FormSection {
  slug: string;
  label: string;
  /** строка состояния справа от названия */
  state: string;
  done: boolean;
}

export const DEMO_FORM_SECTIONS: FormSection[] = [
  { slug: 'osnovnoe', label: 'Основное', state: 'Алексей Сухорада · Фотограф', done: true },
  { slug: 'foto', label: 'Фото', state: '9 из 50', done: true },
  { slug: 'tekst', label: 'Текст', state: '4 раздела', done: true },
  { slug: 'voprosy', label: 'Вопросы', state: '5 из 8', done: false },
  { slug: 'prays', label: 'Прайс', state: '3 пакета', done: true },
  { slug: 'kontakty', label: 'Контакты', state: 'Телефон, Telegram', done: true },
];

// Разделы анкеты площадки (хаб /profi/kabinet/anketa-ploshchadki/). ЗАГЛУШКА
// на примере оранжереи LЁD.
export const DEMO_VENUE_SECTIONS: FormSection[] = [
  { slug: 'osnovnoe', label: 'Основное', state: 'Оранжерея LЁD · Новая Рига', done: true },
  { slug: 'foto', label: 'Фото', state: '6 из 50', done: true },
  { slug: 'zaly', label: 'Залы', state: '1 зал · до 60 гостей', done: true },
  { slug: 'usloviya', label: 'Условия', state: 'Кухня, алкоголь, время', done: true },
  { slug: 'tekst', label: 'Текст', state: '1 раздел из 5', done: false },
  { slug: 'voprosy', label: 'Вопросы', state: '2 из 2', done: true },
  { slug: 'kontakty', label: 'Контакты', state: 'Телефон, почта', done: true },
];
