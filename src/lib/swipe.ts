// ============================================================
// СВАЙП КАРТОЧКИ «ВЛЕВО / ВПРАВО» — нативные pointer-события, без
// библиотек. Механика одна на проект: отбор финалистов в «Избранном»,
// дальше — любое место, где карточку нужно «отбросить» жестом.
//
// Хелпер только считает жест и отдаёт числа; как карточка выглядит
// в полёте — решает вызывающий через onMove/onEnd (transform/opacity,
// моушн-бюджет телефона). Порог — доля ширины элемента либо скорость:
// короткий резкий смах тоже засчитывается.
// ============================================================

export interface SwipeState {
  /** смещение по X от точки захвата, px */
  dx: number;
  dy: number;
  /** −1…1: насколько жест дотянул до порога (знак — сторона) */
  progress: number;
}

export interface SwipeOptions {
  /** доля ширины элемента, после которой жест засчитывается (0.35 по умолчанию) */
  threshold?: number;
  onStart?(): void;
  onMove(state: SwipeState): void;
  /** verdict null — жест не дотянул, карточку надо вернуть на место */
  onEnd(verdict: 'left' | 'right' | null, state: SwipeState): void;
}

export function bindSwipe(el: HTMLElement, opts: SwipeOptions): () => void {
  const threshold = opts.threshold ?? 0.35;
  let active = false;
  let startX = 0;
  let startY = 0;
  let startT = 0;
  let lastState: SwipeState = { dx: 0, dy: 0, progress: 0 };

  const stateOf = (e: PointerEvent): SwipeState => {
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const limit = el.offsetWidth * threshold || 1;
    return { dx, dy, progress: Math.max(-1, Math.min(1, dx / limit)) };
  };

  const onDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    // клик по кнопке или ссылке внутри карточки — не жест
    if ((e.target as HTMLElement).closest('a, button')) return;
    active = true;
    startX = e.clientX;
    startY = e.clientY;
    startT = e.timeStamp;
    el.setPointerCapture(e.pointerId);
    opts.onStart?.();
  };

  const onMove = (e: PointerEvent) => {
    if (!active) return;
    lastState = stateOf(e);
    opts.onMove(lastState);
  };

  const onUp = (e: PointerEvent) => {
    if (!active) return;
    active = false;
    const state = stateOf(e);
    const dt = Math.max(1, e.timeStamp - startT);
    const velocity = Math.abs(state.dx) / dt; // px/ms
    const flung = velocity > 0.6 && Math.abs(state.dx) > 40;
    const verdict = Math.abs(state.progress) >= 1 || flung
      ? (state.dx > 0 ? 'right' : 'left')
      : null;
    opts.onEnd(verdict, state);
  };

  const onCancel = () => {
    if (!active) return;
    active = false;
    opts.onEnd(null, lastState);
  };

  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onCancel);

  return () => {
    el.removeEventListener('pointerdown', onDown);
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerup', onUp);
    el.removeEventListener('pointercancel', onCancel);
  };
}
