// ЗАГЛУШКИ для прототипа админки (/profi/admin/). Каталог и пилот стоят на
// настоящих карточках (lib/admin-catalog.ts), здесь — то, чего ещё нет
// в базе: заявки невест, учётки подрядчиков, жалобы, журнал, настройки.
// Типы — набросок схемы: `leads`, `vendors`, `complaints`, `audit`,
// `mod_rules`, `mail_templates` (CABINET.md §12, §17, §18, §21).
// Имена и контакты невест вымышленные.

export type LeadStatus = 'new' | 'work' | 'done' | 'spam';
export const LEAD_STATUS: Record<LeadStatus, { label: string; cls: string }> = {
  new: { label: 'Новая', cls: 'status--info' },
  work: { label: 'В работе', cls: 'status--warn' },
  done: { label: 'Закрыта', cls: 'status--ok' },
  spam: { label: 'Спам', cls: '' },
};

export interface Lead {
  id: number;
  at: string;
  bride: string;
  contact: string;
  date: string;
  guests: number;
  /** ключ карточки из каталога (`specialist:slug` / `venue:slug`) */
  card: string;
  status: LeadStatus;
  note?: string;
}

export const LEADS: Lead[] = [
  { id: 1048, at: '24.10, 13:52', bride: 'Анна К.', contact: 'почта', date: '14.06.2027', guests: 60, card: 'venue:due-to-love', status: 'new' },
  { id: 1047, at: '24.10, 12:31', bride: 'Мария и Илья', contact: 'Telegram', date: '02.08.2027', guests: 90, card: 'specialist:suhorada', status: 'new' },
  { id: 1046, at: '24.10, 10:08', bride: 'Екатерина Л.', contact: 'почта', date: '21.05.2027', guests: 40, card: 'specialist:galkin', status: 'new' },
  { id: 1045, at: '23.10, 21:44', bride: 'Ольга Д.', contact: 'MAX', date: '12.07.2027', guests: 120, card: 'venue:grebnevo', status: 'work', note: 'Ждёт смету по залам' },
  { id: 1044, at: '23.10, 18:10', bride: 'Дарья и Максим', contact: 'почта', date: '30.09.2027', guests: 35, card: 'specialist:nirvani', status: 'work', note: 'Созвон в пятницу' },
  { id: 1043, at: '23.10, 11:02', bride: 'Ксения В.', contact: 'Telegram', date: '17.06.2027', guests: 70, card: 'venue:villa-barvikha', status: 'done', note: 'Передали площадке' },
  { id: 1042, at: '22.10, 16:27', bride: 'Алина С.', contact: 'почта', date: '05.09.2027', guests: 50, card: 'specialist:solnechnaya', status: 'done' },
  { id: 1041, at: '22.10, 09:15', bride: '—', contact: 'почта', date: '—', guests: 0, card: 'specialist:go-show', status: 'spam', note: 'Ссылка на казино' },
];

export type AccountVia = 'Telegram' | 'MAX' | 'Почта';
export interface Account {
  name: string;
  via: AccountVia;
  cards: string[];
  /** одобренных правок без возвратов (доверие, CABINET.md §12.4) */
  approved: number;
  registered: string;
  lastSeen: string;
  blocked?: boolean;
}

export const ACCOUNTS: Account[] = [
  { name: 'Алексей Сухорада', via: 'Telegram', cards: ['specialist:suhorada'], approved: 0, registered: '24.10', lastSeen: 'сегодня, 12:04' },
  { name: 'Михаил Галкин', via: 'MAX', cards: ['specialist:galkin'], approved: 5, registered: '21.10', lastSeen: 'сегодня, 11:20' },
  { name: 'Даша Нирвани', via: 'Telegram', cards: ['specialist:nirvani'], approved: 8, registered: '21.10', lastSeen: 'сегодня, 10:05' },
  { name: 'Go Show', via: 'Почта', cards: ['specialist:go-show'], approved: 0, registered: '24.10', lastSeen: 'сегодня, 09:38' },
  { name: 'Ольга Солнечная', via: 'Telegram', cards: ['specialist:solnechnaya'], approved: 2, registered: '22.10', lastSeen: 'вчера' },
];

export interface Complaint {
  at: string;
  card: string;
  reason: string;
  from: string;
  status: 'new' | 'checked' | 'rejected';
}
export const COMPLAINT_STATUS = {
  new: { label: 'Новая', cls: 'status--info' },
  checked: { label: 'Разобрали', cls: 'status--ok' },
  rejected: { label: 'Отклонили', cls: '' },
} as const;

export const COMPLAINTS: Complaint[] = [
  { at: '24.10, 11:40', card: 'specialist:kosareva', reason: 'Фото с чужой свадьбы — это наша свадьба, снимал другой оператор', from: 'Невеста, почта', status: 'new' },
  { at: '23.10, 19:12', card: 'venue:villa-dovil', reason: 'Цена на сайте ниже, чем назвали по телефону', from: 'Невеста, Telegram', status: 'new' },
  { at: '20.10, 15:03', card: 'specialist:whynot', reason: 'Не отвечают на звонки', from: 'Невеста, почта', status: 'rejected' },
];

/** Пилот: статусы приглашения по шагам (CABINET.md §19, §22). */
export type PilotStep = 'none' | 'sent' | 'entered' | 'filling' | 'sent_review' | 'published';
export const PILOT_STEP: Record<PilotStep, { label: string; cls: string }> = {
  none: { label: 'Ссылка не выдана', cls: '' },
  sent: { label: 'Ссылка выдана', cls: 'status--info' },
  entered: { label: 'Вошёл', cls: 'status--info' },
  filling: { label: 'Заполняет', cls: 'status--warn' },
  sent_review: { label: 'Отправил на проверку', cls: 'status--warn' },
  published: { label: 'Карточка его', cls: 'status--ok' },
};
/** ключ карточки → шаг; остальные — «ссылка не выдана» */
export const PILOT: Record<string, { step: PilotStep; at?: string; via?: AccountVia }> = {
  'specialist:nirvani': { step: 'published', at: '22.10', via: 'Telegram' },
  'specialist:galkin': { step: 'published', at: '21.10', via: 'MAX' },
  'specialist:suhorada': { step: 'sent_review', at: '24.10', via: 'Telegram' },
  'specialist:solnechnaya': { step: 'filling', at: '22.10', via: 'Telegram' },
  'venue:due-to-love': { step: 'entered', at: '23.10', via: 'MAX' },
  'venue:grebnevo': { step: 'sent', at: '23.10' },
  'specialist:balashova': { step: 'sent', at: '23.10' },
};

/** Утренняя сверка с таблицей реестра — отчёт за 24.10.2026 (registry-nightly). */
export const SYNC_REPORT = {
  at: '24.10.2026, 08:38',
  newInSheet: [
    { name: 'Go Show', cat: 'Шоу', state: 'Заведена 24.10, на сайте' },
    { name: 'Максим Пустовой', cat: 'Фотографы', state: 'Нет портфолио в таблице' },
    { name: 'Евгения Дремина', cat: 'Кондитеры', state: 'Нет портфолио и контактов' },
  ],
  diffs: [
    { name: 'Your Food', field: 'Кухня', sheet: 'Европейская', site: 'Европейская, Вегетарианская, Без глютена' },
    { name: 'Вилла Довиль', field: 'Депозит', sheet: 'от 1 500 000 ₽', site: 'нет на странице' },
  ],
  links: [
    { name: 'Матрешка', problem: 'Ссылка на диск не открывается (404)' },
    { name: 'Лесная Роса', problem: 'Ссылка на диск не открывается (404)' },
    { name: 'LЁD', problem: 'Ссылка на диск не открывается (404)' },
    { name: 'Villa Barvikha 135', problem: 'Яндекс Карты ведут на дом, а не на организацию' },
    { name: 'Вилла Довиль', problem: 'Яндекс Карты ведут на дом, а не на организацию' },
  ],
};

export const MODERATORS = [
  { name: 'Евгений', role: 'Владелец', rights: 'Всё, включая деньги и модераторов', last: 'сегодня' },
  { name: 'Никита', role: 'Администратор', rights: 'Всё, кроме денег', last: 'сейчас' },
  { name: 'Модератор', role: 'Модератор', rights: 'Модерация, жалобы, заявки', last: '—' },
];

/** Правила автопроверки (CABINET.md §12.3): срабатывания за неделю. */
export const RULES = [
  { name: 'Телефон, почта, ссылка, ник @ в тексте', action: 'Не даёт отправить', hits: 14, on: true },
  { name: 'Замаскированный контакт («восемь девятьсот», «инста:»)', action: 'В «Ждут решения»', hits: 3, on: true },
  { name: 'Мат и оскорбления', action: 'В «Ждут решения»', hits: 0, on: true },
  { name: 'Капс, стена эмодзи, хэштеги', action: 'В «Ждут решения»', hits: 2, on: true },
  { name: 'Чужое фото (кадр совпал с другим подрядчиком)', action: 'В «Ждут решения»', hits: 1, on: true },
  { name: 'Мелкое или битое фото (меньше 1600 px)', action: 'Не даёт загрузить', hits: 9, on: true },
  { name: 'Текст не о свадьбе — ИИ-советник', action: 'В «Ждут решения»', hits: 0, on: false },
];

/** Письма подрядчику (CABINET.md §21): системные — автоматически. */
export const LETTERS = [
  { name: 'Код входа и подтверждения почты', when: 'вход, регистрация', sent: 38 },
  { name: 'Карточка получена, проверим до 24 ч', when: 'отправка на проверку', sent: 9 },
  { name: 'Вернули с причиной', when: 'решение модератора', sent: 2 },
  { name: 'Карточка опубликована', when: 'решение модератора', sent: 6 },
  { name: 'Черновик ждёт — 3-й день', when: 'брошенный черновик', sent: 1 },
  { name: 'Черновик ждёт — 10-й день, фото удалятся через 30 дней', when: 'брошенный черновик', sent: 0 },
];

/** Журнал действий: кто что сделал (откат и разбор споров). */
export const AUDIT = [
  { at: '24.10, 12:10', who: 'Никита', what: 'Одобрил правку', target: 'Даша Нирвани' },
  { at: '24.10, 11:58', who: 'Никита', what: 'Выдал личную ссылку', target: 'Гребнево' },
  { at: '23.10, 18:20', who: 'Евгений', what: 'Вернул с причиной: «контакты в тексте»', target: 'Алексей Сухорада' },
  { at: '23.10, 16:05', who: 'Никита', what: 'Скрыл карточку', target: 'Тестовая карточка' },
  { at: '22.10, 10:40', who: 'Евгений', what: 'Добавил модератора', target: 'Модератор' },
];

/** Деньги — третий этап (STAGE2.md §1): что появится в разделе. */
export const MONEY_LATER = [
  { name: 'Баланс подрядчика', text: 'Пополнение, история списаний, остаток — у подрядчика в кабинете и здесь.' },
  { name: 'Списание за открытие контактов', text: 'Первое открытие контактов парой — платное событие, повтор той же пары 30 дней бесплатно.' },
  { name: 'Тарифы и продвижение', text: 'Цена открытия по категориям, платный подъём в каталоге с пометкой.' },
  { name: 'Касса и чеки', text: 'ЮKassa, чеки по 54-ФЗ, акты и реквизиты подрядчика.' },
  { name: 'Защита от накрутки', text: 'Одна пара — одно списание, фильтр ботов, разбор спорных списаний.' },
];
