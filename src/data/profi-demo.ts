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
    note: 'Опубликована 18 октября',
    url: '/moskva/podryadchiki/fotografy/suhorada/',
    filled: 100,
    pending: 'Новые фото и цены на проверке с 12:04 — на сайте пока прежняя версия',
  },
  {
    name: 'Алексей Сухорада',
    role: 'Видеограф',
    status: 'returned',
    note: 'Вернули 19 октября',
    filled: 80,
    reason: 'В тексте указан телефон. Контакты — только в разделе «Контакты».',
  },
];
