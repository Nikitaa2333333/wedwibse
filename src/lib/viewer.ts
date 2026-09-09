// ПРОСМОТР КАДРА НА ВЕСЬ ЭКРАН — поверх доски (PhotoMasonry), без
// перезагрузки. Нажатие на плитку открывает саму фотографию в её настоящей
// пропорции на размытой подложке из неё же; сверху панель как на первом
// кадре карточки (крестик, счётчик, сердце, «поделиться»); внизу на матовой
// полосе — чей это кадр: имя, место, рейтинг с числом отзывов — тот же
// набор, что на карточке каталога. Нажатие по полосе ведёт на полную
// страницу площадки/специалиста. У плитки без владельца (демо-ролики
// общего потока, см. lib/gallery.ts reelPins) полосы под кадром просто нет.
//
// АЛЬБОМ. Листание идёт не по всей доске, а по кадрам ЭТОЙ площадки /
// этого подрядчика: открыл кадр «Лесной Росы» — свайпом смотришь только её,
// счётчик «3 / 14» — тоже по ней. Альбом собирается тут, на клиенте, из
// плиток доски с одинаковой карточкой-источником (href без якоря); ролики
// без владельца — один общий альбом. Отдельно всю галерею площадки в HTML
// не кладём: в доске уже лежат все её вертикальные кадры.
//
// АДРЕС. При открытии в историю кладётся адрес карточки-источника
// (pushState): «назад» в браузере и системный жест закрывают просмотр и
// возвращают доску на то же место — страница не перезагружалась, прокрутка
// на месте. Прямой заход по такому адресу (перезагрузка, ссылка из вкладки)
// просто открывает страницу площадки — отдельных страниц под каждое фото
// нет и не будет, их были бы тысячи. У кадра без карточки-источника адрес
// при открытии не меняется вовсе (пушится только маркер истории).
//
// Листание соседних кадров — стрелки на ПК, свайп на тач, ←/→ с клавиатуры.
// Порядок тот же, что в доске. Библиотек нет: один <img>, которому меняют
// src, и один <video> для роликов.
//
// Разметка — в PhotoMasonry.astro ([data-viewer] и его части).
import { toggleFavorite, isFavorited, type FavoriteItem } from './favorites';
import { bindShareButtons } from './share';

/** кадр в просмотре — один URL под потолком качества (роль hero) и
 *  пропорция; считает сервер в PhotoMasonry, кладёт в data-view плитки
 *  MasonryTile. Не полный srcset: просмотр открывается по клику, не на
 *  первом экране, а полный набор ширин на КАЖДОЙ плитке доски (даже той,
 *  что никто не откроет) — это дублирование, раздувавшее HTML главной на
 *  треть (см. CLAUDE.md про правку веса). Один крупный кадр решает ту же
 *  задачу вчетверо дешевле по разметке. */
export interface ViewFrame {
  src: string;
  w: number;
  h: number;
  alt: string;
  /** у ролика — сам файл; src тогда — его постер */
  video?: string;
}

interface Owner {
  name: string;
  meta: string;
  rating: number | null;
  reviews: number | null;
}

interface Entry {
  pin: HTMLElement;
  /** номер кадра внутри плитки (у мини-галереи их несколько) */
  k: number;
  frame: ViewFrame;
  /** нет владельца (демо-ролик общего потока) — подпись под кадром не рисуем */
  owner: Owner | null;
  /** нет владельца — и вести кадр некуда */
  href: string | null;
  /** снимок для «Избранного» (строка data-save плитки); нет — сердца нет */
  save: FavoriteItem | null;
  /** ключ альбома: карточка-источник без якоря; проставляется при сборке */
  album: string;
  /** кадры того же альбома в порядке доски (индексы в entries) и место в нём */
  siblings: number[];
  pos: number;
}

interface ViewerState {
  viewer: number;
}

function isViewerState(s: unknown): s is ViewerState {
  return !!s && typeof (s as ViewerState).viewer === 'number';
}

export function bindViewer(host: HTMLElement, el: HTMLElement): void {
  const q = <T extends HTMLElement>(sel: string) => el.querySelector<T>(sel)!;
  const bg = q<HTMLImageElement>('[data-viewer-bg]');
  const img = q<HTMLImageElement>('[data-viewer-img]');
  const video = q<HTMLVideoElement>('[data-viewer-video]');
  const owner = q<HTMLAnchorElement>('[data-viewer-owner]');
  const name = q('[data-viewer-name]');
  const meta = q('[data-viewer-meta]');
  const rate = q('[data-viewer-rate]');
  const count = q('[data-viewer-count]');
  const saveBtn = q<HTMLButtonElement>('[data-viewer-save]');
  const closeBtn = q<HTMLButtonElement>('[data-viewer-close]');
  const prevBtn = q<HTMLButtonElement>('[data-viewer-prev]');
  const nextBtn = q<HTMLButtonElement>('[data-viewer-next]');

  // Все кадры доски одним списком в порядке плиток; листание — внутри альбома.
  const entries: Entry[] = [];

  host.querySelectorAll<HTMLElement>('.pin[data-view]').forEach((pin) => {
    const frames = JSON.parse(pin.dataset.view!) as ViewFrame[];
    // owner — "null" строкой для плитки без владельца (JSON.parse даёт null
    // взад без доп. развилки); href пустой атрибут — тоже null.
    const own = JSON.parse(pin.dataset.owner!) as Owner | null;
    const href = pin.dataset.href || null;
    const save = pin.dataset.save ? (JSON.parse(pin.dataset.save) as FavoriteItem) : null;
    const album = href ? href.split('#')[0] : '';
    frames.forEach((frame, k) =>
      entries.push({ pin, k, frame, owner: own, href, save, album, siblings: [], pos: 0 })
    );
  });

  if (!entries.length) return;

  entries.sort((a, b) => Number(a.pin.dataset.i) - Number(b.pin.dataset.i) || a.k - b.k);

  // Альбомы: индексы кадров одной карточки в порядке доски
  const albums = new Map<string, number[]>();
  entries.forEach((e, n) => {
    const list = albums.get(e.album) ?? [];
    e.pos = list.push(n) - 1;
    e.siblings = list;
    albums.set(e.album, list);
  });

  let current = -1;
  let lastFocus: HTMLElement | null = null;

  // Соседний кадр подтягиваем заранее, чтобы листание не показывало пустоту.
  const warm = (n: number | undefined) => {
    const e = n === undefined ? undefined : entries[n];
    if (!e || e.frame.video) return;
    const pre = new Image();
    pre.src = e.frame.src;
  };

  const render = (n: number) => {
    const { frame, owner: own, href, save, siblings, pos } = entries[n];
    current = n;

    img.width = frame.w;
    img.height = frame.h;
    img.alt = frame.alt;
    img.src = frame.src;
    // подложка — тот же кадр (у ролика — постер), размывает CSS
    bg.src = frame.src;

    if (frame.video) {
      video.poster = frame.src;
      video.src = frame.video;
      video.hidden = false;
      img.hidden = true;
      video.play().catch(() => {});
    } else {
      video.pause();
      video.removeAttribute('src');
      video.hidden = true;
      img.hidden = false;
    }

    // Демо-кадр без владельца (см. lib/gallery.ts reelPins) — вся строка
    // подписи под кадром просто не рисуется, не только имя.
    owner.hidden = !own;
    if (own) {
      owner.href = href ?? '#';
      name.textContent = own.name;
      meta.textContent = own.meta;
      rate.hidden = own.rating === null;
      if (own.rating !== null) {
        rate.textContent = `★ ${own.rating.toFixed(1)}${own.reviews ? ` · ${own.reviews} отзывов` : ''}`;
        rate.setAttribute('aria-label', `Рейтинг ${own.rating}`);
      }
    }

    saveBtn.hidden = !save;
    if (save) saveBtn.setAttribute('aria-pressed', String(isFavorited(save.id)));

    // счётчик и стрелки — по альбому, не по всей доске
    count.textContent = `${pos + 1} / ${siblings.length}`;
    prevBtn.disabled = pos === 0;
    nextBtn.disabled = pos === siblings.length - 1;

    warm(siblings[pos + 1]);
    warm(siblings[pos - 1]);
  };

  const open = (n: number, push: boolean) => {
    if (current < 0) {
      lastFocus = document.activeElement as HTMLElement;
      el.classList.add('is-open');
      // Доска под просмотром не листается; прокрутка при этом не сбрасывается
      // (тот же приём, что у шторки в lib/sheet.ts).
      document.documentElement.style.overflow = 'hidden';
    }

    render(n);

    // Кадр без карточки-источника (href null) — адрес не трогаем, пушим
    // только сам маркер: странице, у которой некуда вести, незачем и
    // подделывать адрес.
    const state: ViewerState = { viewer: n };
    const url = entries[n].href ?? undefined;
    if (push) history.pushState(state, '', url);
    else history.replaceState(state, '', url);

    closeBtn.focus({ preventScroll: true });
  };

  const close = () => {
    if (current < 0) return;
    current = -1;
    el.classList.remove('is-open');
    document.documentElement.style.overflow = '';
    video.pause();
    video.removeAttribute('src');
    lastFocus?.focus({ preventScroll: true });
  };

  // Закрыть из интерфейса = шаг назад по истории: запись просмотра снимается,
  // адрес доски возвращается сам, а сам просмотр закрывает уже popstate —
  // один путь и для крестика, и для системной кнопки «назад».
  const dismiss = () => {
    if (isViewerState(history.state)) history.back();
    else close();
  };

  // Шаг — к соседу по альбому; у края альбома жест ничего не делает
  const step = (d: number) => {
    if (current < 0) return;
    const { siblings, pos } = entries[current];
    const n = siblings[pos + d];
    if (n !== undefined) open(n, false);
  };

  // ============ ОТКРЫТИЕ С ПЛИТКИ ============
  // Слушаем всплытие, а не перехват: свайп внутри PhotoRail гасит клик
  // на перехвате раньше нас — листание кадра плитки просмотр не открывает.
  // Клик с модификатором (новая вкладка) отдаём браузеру: ссылка на
  // карточку в href живая.
  host.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    const item = (e.target as HTMLElement).closest<HTMLElement>('.prail__item');
    const pin = item?.closest<HTMLElement>('.pin[data-view]');
    if (!item || !pin) return;

    const k = Array.prototype.indexOf.call(item.parentElement!.children, item);
    const n = entries.findIndex((en) => en.pin === pin && en.k === k);
    if (n < 0) return;

    e.preventDefault();
    open(n, true);
  });

  closeBtn.addEventListener('click', dismiss);
  prevBtn.addEventListener('click', () => step(-1));
  nextBtn.addEventListener('click', () => step(1));

  // Сердце — в верхней панели, отдельная кнопка, не внутри ссылки-полосы:
  // preventDefault не нужен. Снимок берём с текущего кадра, не с кнопки
  // (bindSaveButtons тут не годится — data-save у кнопки меняется).
  saveBtn.addEventListener('click', () => {
    const item = current >= 0 ? entries[current].save : null;
    if (item) saveBtn.setAttribute('aria-pressed', String(toggleFavorite(item)));
  });

  // «Поделиться» — тот же механизм, что у первого кадра карточки
  // (HeroActions): системный лист на телефоне, копия адреса в буфер на ПК.
  bindShareButtons(el);

  // Нажатие по бумаге вокруг кадра (не по самому кадру и не по кнопкам)
  // тоже закрывает — как подложка у шторки.
  el.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-viewer-stage]') && !t.closest('img, video, button')) dismiss();
  });

  document.addEventListener('keydown', (e) => {
    if (current < 0) return;
    if (e.key === 'Escape') dismiss();
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'ArrowRight') step(1);
  });

  // ============ СВАЙП ============
  // Та же арифметика, что у PhotoRail: только начало и конец жеста,
  // порог 36px, косой жест (больше вниз, чем вбок) не считается.
  let x0 = 0;
  let y0 = 0;

  el.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    x0 = t.clientX;
    y0 = t.clientY;
  }, { passive: true });

  el.addEventListener('touchend', (e) => {
    const t = e.changedTouches[0];
    const dx = t.clientX - x0;
    const dy = t.clientY - y0;
    if (Math.abs(dx) < 36 || Math.abs(dx) <= Math.abs(dy)) return;
    step(dx < 0 ? 1 : -1);
  }, { passive: true });

  // ============ ИСТОРИЯ ============
  // Назад/вперёд по истории: запись просмотра — открыть на том кадре,
  // любая другая — закрыть. Возврат на доску из карточки через bfcache
  // приходит как pageshow с persisted: состояние записи читаем оттуда же.
  const sync = (state: unknown) => {
    if (isViewerState(state) && entries[state.viewer]) open(state.viewer, false);
    else close();
  };

  window.addEventListener('popstate', (e) => sync(e.state));
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) sync(history.state);
  });
}

// ============================================================
// ИСТОРИЯ ДЛЯ ЛЮБОЙ ДРУГОЙ ПОЛНОЭКРАННОЙ СЦЕНЫ ПОВЕРХ СТРАНИЦЫ — тот же приём,
// что чуть выше в bindViewer, но без привязки к кадрам доски: открытие кладёт
// маркер в history.pushState, системное «назад»/жест на телефоне закрывают
// сцену через popstate. Используется в «Избранном» (src/pages/izbrannoe/
// index.astro) для сцены отбора («сайты знакомств», свайп карточек) —
// второй раз этот же механизм не пишем, берём готовый отсюда.
export interface HistoryOverlayState {
  ovl: string;
}

function isOverlayState(s: unknown, kind: string): s is HistoryOverlayState {
  return !!s && typeof s === 'object' && (s as HistoryOverlayState).ovl === kind;
}

/** kind — свой у каждой сцены (не путать маркеры разных оверлеев на одной
 *  странице). close — что сделать, когда сцену закрыли снаружи: кнопка
 *  «назад» браузера или системный жест. */
export function bindHistoryOverlay(kind: string, close: () => void) {
  window.addEventListener('popstate', (e) => {
    if (!isOverlayState(e.state, kind)) close();
  });

  return {
    /** вызвать при открытии сцены — кладёт маркер в историю поверх текущего
     *  адреса (адрес не меняется, сцена не должна подделывать URL) */
    push() {
      history.pushState({ ovl: kind } satisfies HistoryOverlayState, '');
    },
    /** вызвать из кнопки-крестика/Escape вместо прямого закрытия: если сцена
     *  верхняя запись истории — шаг назад (закроет её через popstate выше и
     *  туда же вернёт браузер), иначе (маркера в истории почему-то нет) —
     *  закрыть напрямую, без лишнего перехода по истории */
    dismiss() {
      if (isOverlayState(history.state, kind)) history.back();
      else close();
    },
  };
}
