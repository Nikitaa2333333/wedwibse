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

// ============================================================
// ЗВУК РОЛИКА — кнопка над кадром.
//
// Луп играет немым всегда: автозапуск со звуком запрещён во всех
// браузерах, и обойти это нельзя (VIDEO.md). Но у части роликов дорожка
// в файле ЕСТЬ — значит человеку нужно вернуть выбор: нажал кнопку,
// и тот же самый файл зазвучал. Ничего дополнительно не загружается:
// звук уже внутри mp4, второго источника и второго запроса нет.
//
// ЗВУЧИТ ВСЕГДА ТОЛЬКО ОДИН РОЛИК. Включили звук другому — предыдущий
// сам заглушается: в ленте несколько лупов в кадре разом, и два звука
// одновременно превращаются в кашу. Ушёл ролик с экрана — звук снимается
// тоже, иначе он идёт из невидимого кадра.
//
// Разметка: <button class="sound-btn" data-sound="/reels/…mp4">, кнопка
// лежит рядом с кадром; сам <video> ищем по data-video с тем же путём.
// ============================================================

/** ролик, который сейчас звучит: он один на всю страницу */
let loud: HTMLVideoElement | null = null;

function mute(video: HTMLVideoElement): void {
  video.muted = true;
  document
    .querySelectorAll<HTMLButtonElement>(`[data-sound="${CSS.escape(video.dataset.video ?? '')}"]`)
    .forEach((btn) => btn.setAttribute('aria-pressed', 'false'));
  if (loud === video) loud = null;
}

export function bindSoundButtons(root: ParentNode = document): void {
  root.querySelectorAll<HTMLButtonElement>('[data-sound]').forEach((btn) => {
    if (btn.dataset.soundBound) return;
    btn.dataset.soundBound = '1';

    const src = btn.dataset.sound!;
    // Кадр рядом с кнопкой; в рельсе кнопка одна, а роликов может быть
    // несколько — берём тот, чей путь совпал.
    const scope = btn.closest<HTMLElement>('[data-sound-scope]') ?? document;
    const video = scope.querySelector<HTMLVideoElement>(`video[data-video="${CSS.escape(src)}"]`);
    if (!video) return;

    btn.addEventListener('click', (e) => {
      // кнопка может лежать внутри ссылки-кадра (плитка доски) — переход
      // по ней это не должно вызывать
      e.preventDefault();
      e.stopPropagation();

      if (!video.muted) {
        mute(video);
        return;
      }

      if (loud && loud !== video) mute(loud);

      // Файл мог ещё не начать играть (не дошли до кадра, автозапуск
      // отклонён) — нажатие человека это как раз и разрешает.
      if (!video.src) video.src = src;
      video.muted = false;
      video.play().then(() => video.classList.add('is-playing')).catch(() => {});

      loud = video;
      btn.setAttribute('aria-pressed', 'true');
    });

    // Ролик ушёл с экрана — звук снимаем: невидимый кадр звучать не должен.
    new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting && !video.muted) mute(video);
      },
      { threshold: 0.2 }
    ).observe(video);
  });
}
