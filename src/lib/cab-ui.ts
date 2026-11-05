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

/** Крестик «закрыть» — тонкая линия 1.6, как у остальных знаков кабинета. */
export const X_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.6" d="M6 6l12 12M18 6L6 18"/></svg>';

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
  return { dlg, close };
}

let toastTimer = 0;
/**
 * Короткое уведомление внизу экрана. Ошибка (bad) висит, пока не придёт следующее.
 * undo — кнопка «Отменить» (отмена вместо «Вы уверены?», Бюро Горбунова / Контур).
 */
export function toast(text: string, bad = false, ms = 1600, undo?: () => void) {
  let el = document.querySelector<HTMLElement>('.c-toast');
  if (!el) {
    el = document.createElement('p');
    el.className = 'c-toast';
    el.setAttribute('role', 'status');
    document.body.append(el);
  }
  clearTimeout(toastTimer);
  el.textContent = text;
  if (undo) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'c-toast__undo';
    b.textContent = 'Отменить';
    b.addEventListener('click', () => { clearTimeout(toastTimer); el!.classList.remove('is-on'); undo(); });
    el.append(b);
  }
  el.classList.toggle('c-toast--bad', bad);
  el.classList.add('is-on');
  if (!bad) toastTimer = window.setTimeout(() => el!.classList.remove('is-on'), ms);
}

/** Убрать уведомление сразу. */
export function hideToast() {
  clearTimeout(toastTimer);
  document.querySelector('.c-toast')?.classList.remove('is-on');
}
