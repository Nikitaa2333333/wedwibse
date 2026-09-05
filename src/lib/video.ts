// ============================================================
// АВТОЗАПУСК НЕМЫХ ЛУПОВ — один механизм на все места, где встречается
// видео-кадр (доска главной, карусель карточки, галерея площадки).
//
// Правила, ради которых это отдельный модуль (см. VIDEO.md):
//   • файл не качается, пока до кадра не дошли: src подставляется здесь,
//     в разметке его нет (preload="none");
//   • играет только то, что видно, — ушло с экрана, встало на паузу,
//     иначе телефон греется и садится батарея;
//   • где кадры листаются (PhotoRail), к видимости добавляется условие
//     «этот кадр сейчас активен» — его отдаёт вызывающий через active();
//   • prefers-reduced-motion: не запускаем вовсе, остаётся постер.
// ============================================================

export interface VideoHandle {
  /** пересчитать состояние — вызывать, когда меняется active() */
  sync(): void;
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function bindVideo(
  video: HTMLVideoElement,
  opts: { active?: () => boolean; root?: HTMLElement } = {}
): VideoHandle {
  const { active = () => true, root } = opts;
  let onScreen = false;

  const sync = () => {
    if (reducedMotion()) return;

    if (onScreen && active()) {
      if (!video.src) video.src = video.dataset.video!;
      // Промис отваливается там, где автозапуск запрещён (энергосбережение
      // на iPhone) — тогда в кадре просто остаётся постер, это норма.
      video.play().then(() => video.classList.add('is-playing')).catch(() => {});
    } else if (video.src) {
      video.pause();
      video.classList.remove('is-playing');
    }
  };

  new IntersectionObserver(
    ([entry]) => {
      onScreen = entry.isIntersecting;
      sync();
    },
    { threshold: 0.5 }
  ).observe(root ?? video);

  return { sync };
}

/** все видео-кадры внутри узла, которым хватает одной видимости */
export function bindVideosIn(scope: ParentNode): void {
  scope.querySelectorAll<HTMLVideoElement>('video[data-video]').forEach((video) => bindVideo(video));
}
