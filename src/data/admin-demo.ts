// ЗАГЛУШКИ для прототипа админки (/profi/admin/). Карточки — настоящие
// (lib/admin-catalog.ts); здесь — то, чего ещё нет в базе, но что придёт
// вживую: жалобы на карточки (`complaints`, CABINET.md §17) и владельцы
// карточек (`owner`, вход по личной ссылке — CABINET.md §22). Заявки
// партнёров — partner-demo.ts. Выдуманных показателей (просмотры,
// конверсии) здесь нет и не будет: просмотры — в Яндекс Метрике.
// Обращения пар (форма на сайте → `leads`) появятся отдельным разделом,
// когда форму подключат к базе.

export interface Complaint {
  at: string;
  card: string;
  reason: string;
  from: string;
  status: 'new' | 'checked' | 'rejected';
}
export const COMPLAINT_STATUS = {
  new: { label: 'Новая' },
  checked: { label: 'Разобрали' },
  rejected: { label: 'Отклонили' },
} as const;

export const COMPLAINTS: Complaint[] = [
  { at: '24.10, 11:40', card: 'specialist:kosareva', reason: 'Фото с чужой свадьбы — это наша свадьба, снимал другой оператор', from: 'Невеста, почта', status: 'new' },
  { at: '23.10, 19:12', card: 'venue:villa-dovil', reason: 'Цена на сайте ниже, чем назвали по телефону', from: 'Невеста, Telegram', status: 'new' },
  { at: '20.10, 15:03', card: 'specialist:whynot', reason: 'Не отвечают на звонки', from: 'Невеста, почта', status: 'rejected' },
];

/** Владелец карточки: ведём мы → выдали ссылку → вошёл → ведёт сам.
 *  Ссылку модератор копирует и отправляет владельцу сам (решение 20.10). */
export type OwnerStep = 'none' | 'sent' | 'entered' | 'own';
export const OWNER_STEP: Record<OwnerStep, { label: string; dot: string }> = {
  none: { label: 'Ведём мы', dot: '' },
  sent: { label: 'Ссылка выдана', dot: 'info' },
  entered: { label: 'Владелец вошёл', dot: 'warn' },
  own: { label: 'Ведёт сам', dot: 'ok' },
};
export const OWNERS: Record<string, { step: OwnerStep; at?: string; via?: string }> = {
  'specialist:nirvani': { step: 'own', at: '22.10', via: 'Telegram' },
  'specialist:galkin': { step: 'own', at: '21.10', via: 'MAX' },
  'specialist:suhorada': { step: 'own', at: '24.10', via: 'Telegram' },
  'specialist:go-show': { step: 'own', at: '24.10', via: 'почта' },
  'specialist:solnechnaya': { step: 'entered', at: '22.10', via: 'Telegram' },
  'venue:due-to-love': { step: 'entered', at: '23.10', via: 'MAX' },
  'venue:grebnevo': { step: 'sent', at: '23.10' },
  'specialist:balashova': { step: 'sent', at: '23.10' },
};
