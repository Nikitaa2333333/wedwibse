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
    note: 'Последняя правка опубликована 18 октября',
    url: '/moskva/podryadchiki/fotografy/suhorada/',
    filled: 100,
  },
  {
    name: 'Алексей Сухорада',
    role: 'Видеограф',
    status: 'draft',
    note: 'Осталось добавить фото и отправить на проверку',
    filled: 60,
  },
];
