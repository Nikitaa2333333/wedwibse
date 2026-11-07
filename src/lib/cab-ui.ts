// ОКНА И УВЕДОМЛЕНИЯ КАБИНЕТА — один модуль на все экраны (05.11.2026).
// Раньше тост был написан четыре раза, <dialog> собирался руками пять раз,
// крестик-SVG вставлялся семь раз, а окно Яндекс Диска жило на классе панели
// превью и красилось в цвета САЙТА (бумага, чернила) — против правила
// «Кабинет — не сайт». Теперь:
//   openDialog({ html })            — окно кабинета: белая плашка .c-dialog,
//                                     внутри .adm (шрифт и сброс кнопок кабинета);
//   openDialog({ html, site: true }) — ТОЛЬКО превью «как будет на сайте»:
//                                     панель .c-sheet в оформлении витрины;
//   toast(text, bad?)               — короткое уведомление внизу.
// Страница под окном не листается и на айфоне (lockPage из lib/sheet.ts —
// ловушка «панель ездит пальцем», CLAUDE.md).
import { lockPage, unlockPage } from './sheet';

/** Круговая стрелка «повторить» — та же тонкая линия 1.6. */
export const RETRY_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4"/></svg>';

/** Крестик «закрыть» — тонкая линия 1.6, как у остальных знаков кабинета. */
export const X_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.6" d="M6 6l12 12M18 6L6 18"/></svg>';
/** «Назад» / «Вперёд» по правкам текста — изогнутая стрелка, как в Заметках */
export const UNDO_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M9 14 4.5 9.5 9 5M4.5 9.5H14a5.5 5.5 0 0 1 0 11h-3"/></svg>';
export const REDO_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M15 14l4.5-4.5L15 5M19.5 9.5H10a5.5 5.5 0 0 0 0 11h3"/></svg>';
/** список с точками — кнопка «Список» в «Описании» (как в Заметках; в Solar такого нет) */
export const LIST_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="currentColor"><circle cx="5" cy="7" r="1.4"/><circle cx="5" cy="12" r="1.4"/><circle cx="5" cy="17" r="1.4"/></g><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.6" d="M9.5 7H20M9.5 12H20M9.5 17H20"/></svg>';

interface DialogOptions {
  /** содержимое окна (обычно <div class="c-dialog__body">…</div>) */
  html: string;
  /** доп. класс окна */
  cls?: string;
  /** оформление витрины — только для превью карточки */
  site?: boolean;
  /** закрывать нажатием на подложку (по умолчанию да) */
  closeOnBackdrop?: boolean;
  /** можно ли закрыть сейчас (например, пока идёт загрузка — нельзя) */
  canClose?: () => boolean;
  /** после закрытия любым способом: крестик, [data-close], Esc, подложка */
  onClose?: () => void;
}

export function openDialog(opts: DialogOptions): { dlg: HTMLDialogElement; close: () => void } {
  const dlg = document.createElement('dialog');
  dlg.className = `${opts.site ? 'c-sheet' : 'c-dialog'}${opts.cls ? ` ${opts.cls}` : ''}`;
  dlg.innerHTML = opts.html;
  // окно кабинета — внутри корня .adm, чтобы наследовать его шрифт и сброс кнопок
  const parent = opts.site ? document.body : document.querySelector('.adm') ?? document.body;
  parent.append(dlg);

  let closed = false;
  const close = () => {
    if (closed || (opts.canClose && !opts.canClose())) return;
    closed = true;
    dlg.close();
    dlg.remove();
    unlockPage();
    opts.onClose?.();
  };
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  dlg.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-close]') || (t === dlg && opts.closeOnBackdrop !== false)) close();
  });

  lockPage();
  dlg.showModal();
  // showModal ставит фокус на первую кнопку (обычно крестик) — на айфоне вокруг неё вставало кольцо
  // фокуса (Никита 07.11). Фокус — на само окно; поле с autofocus или .focus() из экрана — своё
  dlg.tabIndex = -1;
  if (!dlg.querySelector('[autofocus]')) dlg.focus();
  return { dlg, close };
}

let toastTimer = 0;
let tickTimer = 0;
type ToastAction = (() => void) | { label: string; fn: () => void };
/**
 * Короткое уведомление внизу экрана. Ошибка (bad) висит, пока не придёт следующее.
 * action — кнопка в тосте: функция = «Отменить» (отмена вместо «Вы уверены?»,
 * с кружком-таймером, как в Телеграме: секунды до того, как действие уйдёт);
 * { label, fn } — своё действие, например «Повторить» у ошибки (05.11.2026).
 */
export function toast(text: string, bad = false, ms = 1600, action?: ToastAction) {
  let el = document.querySelector<HTMLElement>('.c-toast');
  if (!el) {
    el = document.createElement('p');
    el.className = 'c-toast';
    el.setAttribute('role', 'status');
    document.body.append(el);
  }
  clearTimeout(toastTimer);
  clearInterval(tickTimer);
  el.textContent = '';
  const isUndo = typeof action === 'function';
  if (isUndo) {
    // время на «Отменить» — заливкой самой капсулы, как ход загрузки фото (Никита 06.11):
    // одна и та же форма у «идёт процесс»; дошла до края — действие ушло
    const f = document.createElement('span');
    f.className = 'c-toast__fill';
    f.style.setProperty('--ms', `${ms}ms`);
    el.append(f);
  }
  const msg = document.createElement('span');
  msg.className = 'c-toast__text';
  msg.textContent = text;
  el.append(msg);
  if (action) {
    const label = isUndo ? 'Отменить' : action.label;
    const fn = isUndo ? action : action.fn;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'c-toast__undo';
    // «Повторить» — с круговой стрелкой (Никита, 05.11)
    b.innerHTML = (label === 'Повторить' ? RETRY_ICON : '') + label;
    b.addEventListener('click', () => { clearTimeout(toastTimer); clearInterval(tickTimer); el!.classList.remove('is-on'); fn(); });
    el.append(b);
  }
  el.classList.toggle('c-toast--bad', bad);
  // открыта клавиатура (видимая область заметно ниже окна) — тост к верху видимой области:
  // внизу его закрывали клавиатура и панель смайликов (Никита 07.11, «Смайлики не добавляем»)
  const vv = window.visualViewport;
  const kb = !!vv && vv.height < window.innerHeight - 120;
  el.classList.toggle('c-toast--kb', kb);
  el.style.top = kb ? `${Math.round(vv!.offsetTop + 12)}px` : '';
  el.classList.remove('is-on');
  void el.offsetWidth; // перезапуск анимации кружка на новом тосте
  el.classList.add('is-on');
  if (!bad) toastTimer = window.setTimeout(() => { clearInterval(tickTimer); el!.classList.remove('is-on'); }, ms);
}

/** Убрать уведомление сразу. */
export function hideToast() {
  clearTimeout(toastTimer);
  clearInterval(tickTimer);
  document.querySelector('.c-toast')?.classList.remove('is-on');
}

// ОТМЕНА ВМЕСТО ПОДТВЕРЖДЕНИЯ (05.11.2026, Бирман: «не спрашивайте — дайте
// отменить»; как «Отменить отправку» в почте). Действие сразу видно на экране,
// а на сервер уходит через несколько секунд; всё это время внизу «Отменить».
//   later({ text, run, undo })
//     text — что произошло («Фото убрано»);
//     run  — настоящее действие (запрос к базе), вызовется один раз;
//     undo — вернуть экран как было (сервер ещё не трогали).
// Ушли со страницы раньше срока — действие выполняется сразу (pagehide,
// переход ClientRouter), поэтому запросы в run шлём с keepalive.
// Подтверждение («Пропадут 12 фото») — только где отменить нельзя совсем.
interface Later { id: number; fire: () => void }
let pending: Later | null = null;
let seq = 0;

export function later(o: { text: string; run: () => unknown; undo: () => void; ms?: number }) {
  flushLater();
  const id = ++seq;
  const ms = o.ms ?? 6000;
  const fire = () => {
    if (pending?.id !== id) return;
    pending = null;
    clearTimeout(timer);
    hideToast();
    o.run();
  };
  const timer = window.setTimeout(fire, ms);
  pending = { id, fire };
  toast(o.text, false, ms, () => {
    if (pending?.id !== id) return;
    pending = null;
    clearTimeout(timer);
    o.undo();
  });
}

/** выполнить отложенное действие сейчас (уходим со страницы) */
export function flushLater() {
  pending?.fire();
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushLater);
  document.addEventListener('astro:before-preparation', flushLater);
}

// ДОЛГАЯ ОПЕРАЦИЯ (05.11.2026, HIG: Progress indicators; правила 5 и 9 скилла).
// Пачка фото, забор с Яндекс Диска: внизу капсула с полоской, процентом и
// «Прервать». Окно можно закрыть и ходить по анкете — загрузка идёт дальше.
// Прервать — текущая порция дойдёт, следующие не начнутся; забранное остаётся.
// Пока идёт — уход со страницы спрашивает браузер (иначе догрузка встанет).
export function progress(text: string, onAbort?: () => void) {
  document.querySelector('.c-progress-pill')?.remove();
  const el = document.createElement('div');
  el.className = 'c-progress-pill';
  el.setAttribute('role', 'status');
  el.innerHTML = `<span class="c-progress-pill__text"></span><span class="c-progress-pill__bar"><i></i></span>${onAbort ? '<button type="button" class="c-progress-pill__stop">Прервать</button>' : ''}`;
  document.body.append(el);
  const t = el.querySelector<HTMLElement>('.c-progress-pill__text')!;
  const bar = el.querySelector<HTMLElement>('.c-progress-pill__bar i')!;
  const guard = (e: BeforeUnloadEvent) => { e.preventDefault(); };
  addEventListener('beforeunload', guard);
  el.querySelector('button')?.addEventListener('click', (e) => {
    (e.currentTarget as HTMLButtonElement).disabled = true;
    t.textContent = 'Останавливаем…';
    onAbort?.();
  });
  const api = {
    update(txt: string, done: number, total: number) {
      const pct = total ? Math.round((done / total) * 100) : 0;
      t.textContent = `${txt} ${pct} %`;
      bar.style.width = `${pct}%`;
    },
    done() { removeEventListener('beforeunload', guard); el.remove(); },
  };
  api.update(text, 0, 1);
  return api;
}

/**
 * Предупреждение по центру экрана — для ошибки действия, которое не удалось
 * («Превью не открылось»), как Alert у Apple (HIG: Alerts): заголовок, пояснение,
 * кнопки называют выбор. Не тост: тост поверх прибитой кнопки её закрывал.
 */
export function alertBox(title: string, text: string, action?: { label: string; fn: () => void }) {
  const esc = (v: string) => v.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  const { dlg, close } = openDialog({
    cls: 'c-alert',
    html: `<div class="c-dialog__body">
      <h2 class="a-h2">${esc(title)}</h2>
      <p>${esc(text)}</p>
      <div class="c-alert__acts">
        ${action ? `<button class="a-btn a-btn--primary a-btn--lg" type="button" data-alert-act>${esc(action.label)}</button>` : ''}
        <button class="a-btn a-btn--lg" type="button" data-close>${action ? 'Закрыть' : 'Понятно'}</button>
      </div>
    </div>`,
  });
  dlg.querySelector('[data-alert-act]')?.addEventListener('click', () => { close(); action!.fn(); });
}
