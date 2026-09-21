// НИЖНЯЯ ШТОРКА — один механизм на все настройки каталога (фильтры,
// сортировка, локация). Разметка — реестр .sheet в global.css:
//   <div class="sheet" data-sheet="имя">
//     <div class="sheet__backdrop" data-sheet-close></div>
//     <section class="sheet__panel" role="dialog" aria-modal="true">
//       <header class="sheet__head">… <button data-sheet-close>…</header>
//       <div class="sheet__body" data-lenis-prevent>…</div>
//       [<footer class="sheet__foot">…</footer>]
//     </section>
//   </div>
// Открывает любая кнопка [data-sheet-open="имя"] на странице, закрывают
// подложка, крестик, Esc и любой [data-sheet-close] внутри.

export interface SheetHandle {
  el: HTMLElement;
  open(opener?: HTMLElement): void;
  close(): void;
}

interface SheetOptions {
  onOpen?: (opener?: HTMLElement) => void;
  onClose?: () => void;
}

// СТРАНИЦА ПОД ШТОРКОЙ СТОИТ НА МЕСТЕ.
// `overflow: hidden` на <html> держит её в десктопных браузерах, но на
// айфоне не держит вовсе: палец по шторке продолжает листать страницу под
// ней, и человеку кажется, что он таскает саму шторку (заказчик, 21.09.2026).
// Единственный способ, который там работает, — увести тело страницы в
// position: fixed, запомнив прокрутку, и вернуть её при закрытии.
// Только на узком экране: на ПК шторка либо стоит колонкой в потоке
// (.sheet--dock), либо фон и так не едет, а fixed на теле поспорил бы
// с полем под вертикальную полосу навигации.
const phone = () => window.matchMedia('(max-width: 1023px)').matches;

let lockedY = 0;

function lockPage() {
  lockedY = window.scrollY;
  document.documentElement.style.overflow = 'hidden';
  if (!phone()) return;
  document.body.style.position = 'fixed';
  document.body.style.top = `-${lockedY}px`;
  document.body.style.left = '0';
  document.body.style.right = '0';
}

function unlockPage() {
  document.documentElement.style.overflow = '';
  if (document.body.style.position !== 'fixed') return;
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.left = '';
  document.body.style.right = '';
  // Возвращаемся ровно туда, где человек открыл шторку: без этого
  // страница после закрытия оказывается в начале.
  window.scrollTo(0, lockedY);
}

export function bindSheet(el: HTMLElement, opts: SheetOptions = {}): SheetHandle {
  const name = el.dataset.sheet!;
  let lastFocus: HTMLElement | null = null;

  const open = (opener?: HTMLElement) => {
    lastFocus = document.activeElement as HTMLElement;
    el.classList.add('is-open');
    lockPage();
    opts.onOpen?.(opener);
    el.querySelector<HTMLElement>('[data-sheet-close]')?.focus({ preventScroll: true });
  };

  const close = () => {
    if (!el.classList.contains('is-open')) return;
    el.classList.remove('is-open');
    unlockPage();
    opts.onClose?.();
    lastFocus?.focus({ preventScroll: true });
  };

  document
    .querySelectorAll<HTMLElement>(`[data-sheet-open="${name}"]`)
    .forEach((btn) => btn.addEventListener('click', () => open(btn)));

  el.querySelectorAll<HTMLElement>('[data-sheet-close]').forEach((c) => c.addEventListener('click', close));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  return { el, open, close };
}
