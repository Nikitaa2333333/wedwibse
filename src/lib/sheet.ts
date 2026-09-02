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

export function bindSheet(el: HTMLElement, opts: SheetOptions = {}): SheetHandle {
  const name = el.dataset.sheet!;
  let lastFocus: HTMLElement | null = null;

  const open = (opener?: HTMLElement) => {
    lastFocus = document.activeElement as HTMLElement;
    el.classList.add('is-open');
    // Страница под шторкой не листается (Lenis выключен, хватает overflow;
    // когда включат — на теле шторки стоит data-lenis-prevent).
    document.documentElement.style.overflow = 'hidden';
    opts.onOpen?.(opener);
    el.querySelector<HTMLElement>('[data-sheet-close]')?.focus({ preventScroll: true });
  };

  const close = () => {
    if (!el.classList.contains('is-open')) return;
    el.classList.remove('is-open');
    document.documentElement.style.overflow = '';
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
