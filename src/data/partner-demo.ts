// ЗАЯВКИ ПАРТНЁРОВ — подрядчики и площадки, которые зарегистрировались
// в кабинете и заполняют анкету новой карточки (CABINET.md §2, §21).
// Главное, что админка отслеживает: кто отправил анкету на проверку и кто
// начал, но бросил черновик — ему звоним или пишем сами.
// Вживую: учётка — `vendors`, анкета — `revisions` первой публикации
// (data = анкета, status = draft / review / returned / approved / rejected),
// комментарии команды — `notes`. Сейчас — ПРИМЕРЫ: имена Дреминой,
// Пустового и Go Show — из реестра заказчика, контакты — заглушки, не
// настоящие номера. Go Show — настоящая карточка сайта, по ней видно,
// как выглядит заполненная анкета.
import type { StorySection } from './specialists';

export type AppStatus = 'draft' | 'review' | 'returned' | 'approved' | 'rejected';

/** Статусы — глазами администратора: что с заявкой и что делать ему. */
export const APP_STATUS: Record<AppStatus, { label: string; dot: string; tab: string }> = {
  review: { label: 'Проверить анкету', dot: 'info', tab: 'Проверить' },
  draft: { label: 'Не закончил анкету', dot: 'warn', tab: 'Не закончили' },
  returned: { label: 'Ждём исправлений', dot: 'bad', tab: 'Вернули' },
  approved: { label: 'Опубликована', dot: 'ok', tab: 'Опубликованы' },
  rejected: { label: 'Отклонена', dot: '', tab: 'Отклонены' },
};

/** Раздел анкеты и его заполненность — те же разделы, что в кабинете (DEMO_FORM_SECTIONS). */
export interface AppSection {
  label: string;
  /** коротко: «12 из 50», «2 раздела», «нет» */
  state: string;
  done: boolean;
}

export interface AppNote {
  who: string;
  at: string;
  text: string;
}

export interface PartnerApp {
  id: string;
  name: string;
  /** категория или «Площадка» */
  category: string;
  status: AppStatus;
  /** когда начал анкету */
  started: string;
  /** последнее действие подрядчика */
  lastEdit: string;
  /** сколько ждёт ответа (только у отправленных; срок — 24 ч) */
  waitingHours?: number;
  via: 'Telegram' | 'MAX' | 'Почта';
  contacts: { phone?: string; telegram?: string; email?: string };
  /** фото по ссылке на Яндекс.Диск: сервер забирает кадры сам (CABINET.md §13) */
  disk?: { url: string; state: string };
  sections: AppSection[];
  /** slug настоящей карточки сайта, если анкета уже как у неё (превью фото и текста) */
  cardSlug?: string;
  /** текст анкеты, если карточки на сайте нет */
  story?: StorySection[];
  priceNote?: string;
  notes: AppNote[];
  history: { at: string; text: string }[];
}

export const PARTNER_APPS: PartnerApp[] = [
  {
    id: 'go-show',
    name: 'Go Show',
    category: 'Шоу',
    status: 'review',
    started: '22.10',
    lastEdit: 'сегодня, 09:38',
    waitingHours: 3,
    via: 'Почта',
    contacts: { phone: '+7 900 000-00-01', email: 'goshow@example.ru' },
    disk: { url: 'https://disk.yandex.ru/d/example-goshow', state: 'забрали 46 фото и 5 роликов' },
    sections: [
      { label: 'Основное', state: 'название, категория', done: true },
      { label: 'Фото', state: '46 из 50', done: true },
      { label: 'Видео', state: '5 роликов', done: true },
      { label: 'Текст', state: '5 разделов', done: true },
      { label: 'Прайс', state: '9 тарифов', done: true },
      { label: 'Контакты', state: 'телефон, почта', done: true },
    ],
    cardSlug: 'go-show',
    notes: [{ who: 'Никита', at: 'сегодня, 10:02', text: 'Проверить тарифы — в архиве их было 9, всё сходится.' }],
    history: [
      { at: '22.10, 18:40', text: 'Зарегистрировался по почте, принял оферту' },
      { at: '23.10, 12:15', text: 'Загрузил 46 фото и 5 роликов' },
      { at: 'сегодня, 09:38', text: 'Отправил анкету на проверку' },
    ],
  },
  {
    id: 'dremina',
    name: 'Евгения Дремина',
    category: 'Кондитер',
    status: 'draft',
    started: '21.10',
    lastEdit: '3 дня назад',
    via: 'Telegram',
    contacts: { telegram: '@example_dremina' },
    sections: [
      { label: 'Основное', state: 'имя, категория', done: true },
      { label: 'Фото', state: 'нет ни одного', done: false },
      { label: 'Текст', state: '2 раздела', done: true },
      { label: 'Прайс', state: '3500 ₽/кг', done: true },
      { label: 'Фильтры', state: '3 из 5', done: false },
      { label: 'Контакты', state: 'нет', done: false },
    ],
    story: [
      { title: 'Обо мне', text: ['10 лет в кондитерском искусстве. Безупречный вкус. Дизайн без границ.', 'Меня зовут Евгения. Я создаю свадебные торты и десерты, которые не стыдно поставить в центр главного стола. За 10 лет я прошла от классических десертов до сложнейших многоярусных конструкций.'] },
      { title: 'Стоимость', text: ['3500 ₽/кг + декор. Каждый торт надо просчитывать отдельно.'] },
    ],
    notes: [],
    history: [
      { at: '21.10, 20:12', text: 'Вошла через Telegram, приняла оферту' },
      { at: '21.10, 20:30', text: 'Заполнила текст и прайс' },
      { at: '—', text: 'Фото и контакты не добавила, анкету не отправила' },
    ],
  },
  {
    id: 'pustovoy',
    name: 'Максим Пустовой',
    category: 'Фотограф',
    status: 'review',
    // ПРИМЕР срока, который горит: ждёт 21 ч из 24 — в админке красным
    waitingHours: 21,
    started: '20.10',
    lastEdit: '4 дня назад',
    via: 'MAX',
    contacts: { phone: '+7 900 000-00-02' },
    sections: [
      { label: 'Основное', state: 'имя, категория', done: true },
      { label: 'Фото', state: 'нет ни одного', done: false },
      { label: 'Текст', state: '1 раздел', done: true },
      { label: 'Прайс', state: '4 тарифа', done: true },
      { label: 'Фильтры', state: '6 из 9', done: false },
      { label: 'Контакты', state: 'телефон', done: true },
    ],
    story: [
      { title: 'О себе', text: ['TOP 20 свадебных фотографов России 2023–2025 по версии MY WED. Свадьбы, события, эстетика.', 'Срок сдачи материала — 1 месяц. 18–20 обработанных фото в час. 800+ счастливых клиентов.'] },
      { title: 'Цены', list: ['Час — 10 000 ₽', 'Полный день под ключ — 120 000 ₽', 'Фото + видео, час — 16 000 ₽', 'Фото + видео, полный день — 160 000 ₽'] },
    ],
    notes: [{ who: 'Евгений', at: '22.10, 15:20', text: 'Обещал прислать портфолио на неделе.' }],
    history: [
      { at: '20.10, 11:05', text: 'Вошёл через MAX, принял оферту' },
      { at: '20.10, 11:40', text: 'Заполнил текст, тарифы, телефон' },
      { at: '—', text: 'Фото не загрузил, анкету не отправил' },
    ],
  },
  {
    id: 'vysota',
    name: 'Лофт «Высота»',
    category: 'Площадка',
    status: 'returned',
    started: '18.10',
    lastEdit: 'вчера, 16:10',
    via: 'Почта',
    contacts: { phone: '+7 900 000-00-03', email: 'loft@example.ru' },
    disk: { url: 'https://disk.yandex.ru/d/example-loft', state: 'забрали 12 фото, ждём остальные' },
    sections: [
      { label: 'Основное', state: 'название, адрес', done: true },
      { label: 'Фото', state: '12 из 50', done: false },
      { label: 'Залы', state: '2 зала', done: true },
      { label: 'Условия', state: 'аренда, кухня', done: true },
      { label: 'Текст', state: '1 раздел', done: true },
      { label: 'Контакты', state: 'телефон, почта', done: true },
    ],
    story: [
      { title: 'О площадке', text: ['Лофт на 18 этаже с панорамными окнами на центр Москвы. Два зала: банкетный на 80 гостей и терраса для церемонии.', 'Звоните: 8 900 000 00 03.'] },
    ],
    notes: [{ who: 'Никита', at: 'вчера, 16:30', text: 'Вернули: телефон в тексте и мало фото залов.' }],
    history: [
      { at: '18.10, 14:00', text: 'Зарегистрировались по почте' },
      { at: '23.10, 15:50', text: 'Отправили анкету на проверку' },
      { at: 'вчера, 16:10', text: 'Вернули: «Уберите телефон из текста, добавьте фото залов — сейчас 12»' },
    ],
  },
  {
    id: 'belyy-len',
    name: 'Студия «Белый лён»',
    category: 'Декоратор',
    status: 'approved',
    started: '15.10',
    lastEdit: '19.10',
    via: 'Telegram',
    contacts: { telegram: '@example_belyylen' },
    sections: [
      { label: 'Основное', state: 'название, категория', done: true },
      { label: 'Фото', state: '38 из 50', done: true },
      { label: 'Текст', state: '4 раздела', done: true },
      { label: 'Прайс', state: 'от 60 000 ₽', done: true },
      { label: 'Контакты', state: 'Telegram', done: true },
    ],
    story: [{ title: 'О студии', text: ['Оформляем свадьбы в натуральных тканях и живой зелени.'] }],
    notes: [],
    history: [
      { at: '19.10, 12:00', text: 'Одобрено · Никита, карточка на сайте' },
    ],
  },
];

/** Текст напоминания тому, кто бросил черновик: копируем и отправляем сами. */
export function reminderText(app: PartnerApp): string {
  const missing = app.sections.filter((s) => !s.done).map((s) => s.label.toLowerCase());
  const first = app.name.split(' ')[0];
  return `${first}, здравствуйте! Это WED Secrets. Вы начали заполнять анкету в кабинете, но пока не отправили её на проверку. Осталось добавить: ${missing.join(', ')}. Если что-то не получается — напишите, поможем. Ссылка на кабинет: https://profi.wed-secrets.ru/`;
}
