// ============================================================
// ПЛАШКА «ДОБАВЛЕНО В ИЗБРАННОЕ» — отклик на сердце.
// Всплывает снизу над доком чернильной капсулой — тем же языком, что
// плавающая кнопка заявки (StickyCta): .pill в инверсии, без стекла
// и без своих «пушевых» форм (заказчик, 30.09.2026: стекло в проекте
// запрещено, собирать из наших компонентов). Вся капсула — ссылка
// в «Избранное»: «♥ Добавлено в избранное · Открыть».
// Если в этот момент висит капсула заявки, плашка встаёт над ней
// (body:has(.scta.is-shown) в global.css), а не накрывает.
//
// Одна плашка на страницу, создаётся при первом добавлении и дальше
// переиспользуется: быстрые нажатия подряд продлевают показ, а не
// громоздят стопку. Моушн — CSS (.fav-toast), тайминги — токены.
// ============================================================
import { spriteVersion } from './icons';

let el: HTMLElement | null = null;
let hideTimer = 0;

function build(): HTMLElement {
  const root = document.createElement('div');
  root.className = 'fav-toast';
  root.setAttribute('role', 'status');
  root.setAttribute('aria-live', 'polite');
  root.innerHTML =
    '<a class="pill pill--icon fav-toast__pill" href="/izbrannoe/">' +
    `<svg class="fav-toast__icon" fill="currentColor" aria-hidden="true"><use href="/icons.svg?v=${spriteVersion}#i-heart"/></svg>` +
    '<span>Добавлено в избранное</span>' +
    '<span class="fav-toast__open">Открыть</span>' +
    '</a>';
  document.body.append(root);
  return root;
}

/** сколько плашка висит, мс — из токена --dur-toast */
function holdMs(): number {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--dur-toast').trim();
  const n = parseFloat(v);
  return v.endsWith('ms') ? n : n * 1000;
}

export function showFavToast(): void {
  el ??= build();
  // Класс ставим через кадр — иначе у только что созданной плашки
  // выезд не проиграется.
  const root = el;
  requestAnimationFrame(() => root.classList.add('is-shown'));

  clearTimeout(hideTimer);
  hideTimer = window.setTimeout(() => root.classList.remove('is-shown'), holdMs());
}

/** убрали из избранного, пока плашка висит — прячем сразу */
export function hideFavToast(): void {
  clearTimeout(hideTimer);
  el?.classList.remove('is-shown');
}
