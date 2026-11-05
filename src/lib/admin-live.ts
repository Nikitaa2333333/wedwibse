// ЖИВЫЕ ДАННЫЕ АДМИНКИ — один загрузчик на меню, «Сводку», «Заявки»
// и «Модерацию» (05.11.2026). До этого всё это рисовалось из демо-файлов
// (partner-demo, moderation-demo, admin-demo): модератор видел задачи,
// сроки и красные цифры, которых не было. Правило кабинета — «никаких
// выдуманных цифр»: показываем только то, что лежит в базе, иначе пусто.
//
// Деление разделов:
//   «Заявки»    — НОВЫЕ карточки (ревизия без venue/specialist): на проверке,
//                 не закончили (черновик), вернули;
//   «Модерация» — правки ОПУБЛИКОВАННЫХ карточек: на проверке и проверено.
// Жалоб в базе пока нет (CABINET.md §17 — не подключено), счётчика нет.
import { api, esc, session } from './cabinet-api';
import { SECTIONS, sectionState, NBSP } from './cabinet-form';

/** срок ответа — 24 часа с отправки (docs/cabinet/CABINET.md, STAGE2) */
export const DEADLINE_MIN = 24 * 60;
/** меньше 4 часов до конца срока — красным */
export const URGENT_MIN = 4 * 60;

export const isNew = (r: any) => !r.venue && !r.specialist;

const at = (d: string) => new Date(String(d).replace(' ', 'T')).getTime();

/** минут до конца срока у отправленной ревизии */
export function leftMin(r: any): number | undefined {
  return r.status === 'review' && r.submittedAt ? DEADLINE_MIN - Math.round((Date.now() - at(r.submittedAt)) / 60000) : undefined;
}

export const leftText = (m: number) => (m <= 0 ? 'срок вышел' : m < 60 ? `осталось ${m}${NBSP}мин` : `осталось ${Math.floor(m / 60)}${NBSP}ч`);

/** «5 нояб.» / «сегодня» — когда последний раз трогали */
export function whenText(d: string): string {
  const t = new Date(at(d));
  const today = new Date();
  if (t.toDateString() === today.toDateString()) return `сегодня в ${t.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
  return t.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace(/\s/g, NBSP);
}

/** заполненность черновика, %: обязательные разделы анкеты (без «Вопросов» — у них свой набор на категорию) */
export function fillPct(r: any): number {
  const keys = (SECTIONS[r.kind as 'venue' | 'specialist'] ?? []).filter((s) => !s.optional && s.key !== 'voprosy');
  if (!keys.length) return 0;
  const done = keys.filter((s) => sectionState(s.key, r, []).done).length;
  return Math.round((done / keys.length) * 100);
}

let cache: { t: number; p: Promise<any[]> } | null = null;

/**
 * Все ревизии, кроме давно одобренных: на проверке, черновики, вернули,
 * и решения за последние 30 дней (для «Проверено»). Кэш на 20 с — меню,
 * сводка и раздел на одной странице делают один запрос, а не три.
 */
export function loadRevisions(force = false): Promise<any[]> {
  if (!session('moderator')) return Promise.resolve([]);
  if (!force && cache && Date.now() - cache.t < 20000) return cache.p;
  const since = new Date(Date.now() - 30 * 864e5).toISOString().replace('T', ' ');
  const filter = `status != "approved" || reviewedAt >= "${since}"`;
  const p = api('moderator', 'GET', `/api/collections/revisions/records?perPage=500&sort=-updated&expand=owner&filter=${encodeURIComponent(filter)}`)
    .then((res) => res.items as any[]);
  cache = { t: Date.now(), p };
  p.catch(() => { cache = null; });
  return p;
}

export function counts(revs: any[]) {
  const review = revs.filter((r) => r.status === 'review');
  return {
    newReview: review.filter(isNew),
    editReview: review.filter((r) => !isNew(r)),
    drafts: revs.filter((r) => isNew(r) && r.status === 'draft'),
  };
}

/**
 * Строка задачи — .a-task (admin.css). Одна плашка справа — что сделать;
 * под именем текстом — срок (красным, если меньше 4 ч). Имени владельца
 * и точек-разделителей в строке нет (Никита, 05.11).
 * Обложки у ревизии нет — первая буква имени. Ведёт на разбор.
 */
// задача → цвет статуса по общей схеме (05.11): проверить — голубой (ждёт проверки),
// одобрили — зелёный, вернули — красный, не закончена — жёлтый. Было: проверить зелёным (27.10) —
// рядом с «Одобрили» путалось.
const TONE = { check: ' status--info', ok: ' status--ok', wait: ' status--warn', bad: ' status--bad', none: '' } as const;

export function taskRow(r: any, o: { task: string; tone: 'check' | 'ok' | 'wait' | 'bad' | 'none'; fill?: boolean }): string {
  const href = `/profi/admin/moderaciya/pravka/?id=${encodeURIComponent(r.id)}`;
  const name = String(r.data?.name || '').trim() || 'Без названия';
  const left = leftMin(r);
  const pill = `<span class="status${TONE[o.tone]}">${esc(o.task)}${o.fill ? `<span class="status__n">${fillPct(r)}${NBSP}%</span>` : ''}</span>`;
  const when = left !== undefined
    ? `<span class="${left < URGENT_MIN ? 'a-task__urgent' : ''}">${leftText(left)}</span>`
    : whenText(r.updated);
  // data-astro-reload: переходом ClientRouter разбор не запускался (26.10)
  return `<a class="a-task" href="${href}" data-astro-reload>`
    + `<span class="a-task__cover a-task__cover--empty" aria-hidden="true">${esc(name.slice(0, 1))}</span>`
    + `<span class="a-task__body"><span class="a-task__name">${esc(name)}</span><span class="a-task__sub">${when}</span></span>`
    + `${pill}</a>`;
}

/** блок ошибки загрузки со ссылкой «Повторить» (правило 4 скилла) */
export function failBox(text: string): string {
  return `<div class="a-fail" role="alert"><p>${esc(text)}</p><button type="button" class="c-chipbtn" data-retry>Повторить</button></div>`;
}

/** число в меню (ПК и телефон): 0 — прячем */
export function setNavCount(key: string, n: number) {
  document.querySelectorAll<HTMLElement>(`[data-nav-n="${key}"]`).forEach((el) => {
    el.textContent = String(n);
    el.hidden = n === 0;
  });
}
