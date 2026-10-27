// Задачи админки: из заявок и правок — то, что рисует AdminTask
// (обложка, заполненность, минуты до конца срока). Один расчёт на сводку,
// «Заявки» и «Модерацию», чтобы срок и проценты не разъезжались.
import { cardByKey } from './admin-catalog';
import type { PartnerApp } from '../data/partner-demo';

/** срок ответа — 24 часа с отправки (CABINET.md, STAGE2) */
export const DEADLINE_MIN = 24 * 60;

/** обложка — первый кадр карточки сайта, если анкета уже как у неё */
export function appCover(a: PartnerApp): string | undefined {
  return cardByKey(`specialist:${a.cardSlug ?? a.id}`)?.cover ?? cardByKey(`venue:${a.cardSlug ?? a.id}`)?.cover;
}

export function appFill(a: PartnerApp): number {
  return Math.round((a.sections.filter((x) => x.done).length / a.sections.length) * 100);
}

/** минут до конца срока у отправленной анкеты; у черновика срока нет */
export function appLeft(a: PartnerApp): number | undefined {
  return a.status === 'review' && a.waitingHours !== undefined ? DEADLINE_MIN - a.waitingHours * 60 : undefined;
}

/** «3 ч 10 мин» (сколько ждёт) → минуты */
export function waitedMin(s?: string): number {
  const m = s?.match(/(\d+)\s*ч(?:\s*(\d+))?/);
  return m ? Number(m[1]) * 60 + Number(m[2] ?? 0) : 0;
}

/** «через 4 ч» — ближайший срок в списке задач */
export function soonest(lefts: (number | undefined)[]): number | undefined {
  const xs = lefts.filter((x): x is number => x !== undefined);
  return xs.length ? Math.min(...xs) : undefined;
}

export const leftLabel = (m: number) => (m <= 0 ? 'срок вышел' : m < 60 ? `${m} мин` : `${Math.floor(m / 60)} ч`);
