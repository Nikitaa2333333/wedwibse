// ============================================================
// ПОЛЁТ «В ИЗБРАННОЕ» — отклик на добавление карточки.
// Из нажатой кнопки выпускается чернильный кружок с сердцем и по
// параболе брошенного предмета летит к вкладке «Избранное» нижнего
// дока (на ПК — к рельсу слева). Приземлившись, вкладка пружинит,
// от неё расходится тонкое кольцо, счётчик на плече вспыхивает новым
// числом — человек видит, КУДА легла карточка, а не только что кнопка
// сменила подпись.
//
// Только Web Animations API и transform/opacity: без зависимостей,
// укладывается в моушн-бюджет телефона. Тайминги и кривые — токены
// --dur-flight / --ease-* из global.css, своих чисел тут нет.
//
// Док слушает два события: FLY_EVENT — «кружок в пути, число пока не
// меняй», LAND_EVENT — «долетел, обновляй». Так счётчик щёлкает ровно
// в момент касания, а не за полсекунды до него.
// ============================================================
import { spriteVersion } from './icons';

export const FLY_EVENT = 'wed:fav-fly';
export const LAND_EVENT = 'wed:fav-land';

/** куда лететь — иконка вкладки «Избранное» (метка в BottomDock) */
const TARGET = '[data-fav-target]';

/** на сколько кружок взмывает над высшей из двух точек, px */
const LIFT = 72;

function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** '0.78s' / '780ms' → 780 */
function ms(value: string): number {
  const n = parseFloat(value);
  return value.endsWith('ms') ? n : n * 1000;
}

function center(el: Element) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, visible: r.width > 0 && r.height > 0 };
}

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Отзывчивость самой кнопки: короткое «нажатие» масштабом.
 * Работает и без дока (раздел «Избранное», старые страницы).
 */
export function pressPop(btn: HTMLElement): void {
  if (reducedMotion()) return;
  btn.animate(
    [{ transform: 'scale(1)' }, { transform: 'scale(0.9)', offset: 0.3 }, { transform: 'scale(1)' }],
    { duration: ms(token('--dur-fast')) * 1.2, easing: token('--ease-out') },
  );
}

/**
 * Выпускает кружок от кнопки к вкладке «Избранное».
 * Вкладки нет или она не на экране — тихо ничего не делает:
 * счётчик тогда обновится обычным путём, по событию хранилища.
 */
export function flyToFavorites(from: HTMLElement): void {
  const target = document.querySelector<HTMLElement>(TARGET);
  if (!target || reducedMotion()) return;

  const a = center(from);
  const b = center(target);
  if (!a.visible || !b.visible) return;

  const dx = b.x - a.x;
  const dy = b.y - a.y;

  // Вершина параболы — над высшей из двух точек. Момент вершины
  // считаем из той же физики: время подъёма и спуска относятся как
  // корни из высот (y = g·t²/2), тогда стык двух кривых гладкий.
  const apex = Math.min(0, dy) - LIFT;
  const up = Math.sqrt(-apex);
  const down = Math.sqrt(dy - apex);
  const apexAt = up / (up + down);

  const duration = ms(token('--dur-flight'));

  const root = document.createElement('div');
  root.className = 'fav-flight';
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML =
    `<div class="fav-flight__y"><div class="fav-flight__dot">` +
    `<svg fill="currentColor"><use href="/icons.svg?v=${spriteVersion}#i-heart"/></svg>` +
    `</div></div>`;
  root.style.transform = `translate(${a.x}px, ${a.y}px)`;
  document.body.append(root);

  const yLayer = root.firstElementChild as HTMLElement;
  const dot = yLayer.firstElementChild as HTMLElement;

  window.dispatchEvent(new CustomEvent(FLY_EVENT));

  const x = root.animate(
    [{ transform: `translate(${a.x}px, ${a.y}px)` }, { transform: `translate(${b.x}px, ${a.y}px)` }],
    { duration, easing: token('--ease-glide'), fill: 'forwards' },
  );

  yLayer.animate(
    [
      { transform: 'translateY(0)', easing: token('--ease-rise') },
      { transform: `translateY(${apex}px)`, offset: apexAt, easing: token('--ease-fall') },
      { transform: `translateY(${dy}px)` },
    ],
    { duration, fill: 'forwards' },
  );

  // Кружок вырастает из кнопки с лёгким перелётом, в пути держит
  // размер и к самой вкладке сжимается до её иконки — «входит» в неё.
  // Кривая — у каждого отрезка своя: общая easing в опциях сжала бы
  // всю раскадровку к началу, и кружок таял бы, не долетев.
  const out = token('--ease-out');
  const inout = token('--ease-inout');
  dot.animate(
    [
      { transform: 'scale(0.4)', opacity: 0, easing: out },
      { transform: 'scale(1.1)', opacity: 1, offset: 0.16, easing: out },
      { transform: 'scale(1)', opacity: 1, offset: 0.32, easing: inout },
      { transform: 'scale(0.55)', opacity: 1, offset: 0.88, easing: out },
      { transform: 'scale(0.35)', opacity: 0 },
    ],
    { duration, fill: 'forwards' },
  );

  x.finished.then(() => {
    root.remove();
    land(target);
    window.dispatchEvent(new CustomEvent(LAND_EVENT));
  });
}

/** Приземление: вкладка пружинит, вокруг расходится кольцо. */
function land(target: HTMLElement): void {
  const spring = token('--ease-spring');
  const base = ms(token('--dur-base'));

  target.animate(
    [
      { transform: 'scale(1)' },
      { transform: 'scale(0.82)', offset: 0.18 },
      { transform: 'scale(1.18)', offset: 0.5 },
      { transform: 'scale(1)' },
    ],
    { duration: base, easing: spring },
  );

  // Вкладка в доке приглушена, пока раздел не открыт; на миг
  // проявляем её целиком, чтобы отклик было видно, и гасим обратно.
  const item = target.closest<HTMLElement>('.dock__item');
  item?.animate(
    [{ opacity: 1, offset: 0.08 }, { opacity: 1, offset: 0.7 }],
    { duration: base * 1.6, easing: token('--ease-out') },
  );

  const c = center(target);
  const ring = document.createElement('div');
  ring.className = 'fav-flight__ring';
  ring.setAttribute('aria-hidden', 'true');
  ring.style.transform = `translate(${c.x}px, ${c.y}px)`;
  document.body.append(ring);
  ring
    .animate(
      [
        { transform: `translate(${c.x}px, ${c.y}px) scale(0.5)`, opacity: 0.5 },
        { transform: `translate(${c.x}px, ${c.y}px) scale(1.6)`, opacity: 0 },
      ],
      { duration: base, easing: token('--ease-out'), fill: 'forwards' },
    )
    .finished.then(() => ring.remove());
}
