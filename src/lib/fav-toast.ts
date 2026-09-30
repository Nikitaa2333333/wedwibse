// ============================================================
// ПЛАШКА «ДОБАВЛЕНО В ИЗБРАННОЕ» — отклик на сердце.
// Выезжает снизу, над нижним доком, как пуш на телефоне: кадр карточки,
// «Добавлено», её имя и «Открыть» — прямой путь в раздел. Короче, чем
// «Добавлено в избранное»: длинная строка рядом с кнопкой на телефоне
// обрезалась многоточием.
// Через пару секунд уезжает сама. Заменила полёт кружка во вкладку
// (заказчик, 30.09.2026: «просто плашечка снизу, как пуш»).
//
// Одна плашка на страницу, создаётся при первом добавлении и дальше
// переиспользуется: быстрые нажатия подряд не громоздят стопку,
// а обновляют текст и продлевают показ. Моушн — CSS (global.css,
// .fav-toast), тайминги — токены; здесь только состояние.
// ============================================================
import type { FavoriteItem } from './favorites';

let el: HTMLElement | null = null;
let hideTimer = 0;

function build(): HTMLElement {
  const root = document.createElement('div');
  root.className = 'fav-toast';
  root.setAttribute('role', 'status');
  root.setAttribute('aria-live', 'polite');
  root.innerHTML =
    '<span class="fav-toast__thumb"><img alt="" decoding="async" /></span>' +
    '<span class="fav-toast__text">' +
    '<span class="fav-toast__title">Добавлено</span>' +
    '<span class="fav-toast__name"></span>' +
    '</span>' +
    '<a class="pill pill--sm fav-toast__open" href="/izbrannoe/">Открыть</a>';
  document.body.append(root);
  return root;
}

/** сколько плашка висит, мс — из токена --dur-toast */
function holdMs(): number {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--dur-toast').trim();
  const n = parseFloat(v);
  return v.endsWith('ms') ? n : n * 1000;
}

export function showFavToast(item: FavoriteItem): void {
  el ??= build();

  const img = el.querySelector<HTMLImageElement>('img')!;
  const thumb = el.querySelector<HTMLElement>('.fav-toast__thumb')!;
  thumb.hidden = !item.img;
  if (item.img) img.src = item.img;
  el.querySelector('.fav-toast__name')!.textContent = item.name;

  // Снимаем и ставим класс через кадр — иначе выезд не проиграется,
  // если плашка создана только что.
  const root = el;
  requestAnimationFrame(() => root.classList.add('is-open'));

  clearTimeout(hideTimer);
  hideTimer = window.setTimeout(() => root.classList.remove('is-open'), holdMs());
}

/** убрали из избранного, пока плашка висит — прячем сразу */
export function hideFavToast(): void {
  clearTimeout(hideTimer);
  el?.classList.remove('is-open');
}
