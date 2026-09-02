// ============================================================
// ДОСКА КАДРОВ ГЛАВНОЙ — пул фотографий всего каталога.
// Галерея на главной не привязана к одной площадке: сюда стекается
// gallery каждой карточки из VENUES, поэтому новая площадка попадает
// на главную сама, без правок вёрстки. Появятся подрядчики со своими
// кадрами — тем же способом добавится ещё один источник.
//
// Плитка (Pin) может нести несколько кадров: тогда в ней работает
// PhotoRail — точки-индикаторы и листание свайпом, как в карточке
// каталога. Пропорция берётся из самого файла: ряды доски специально
// не выравниваются, «рваная» высота и есть ритм галереи.
// ============================================================
import { VENUES } from '../data/venues';
import { resolveImage } from './images';

export interface Pin {
  /** один кадр — статичная плитка, несколько — мини-галерея с точками */
  photos: string[];
  alt: string;
  href: string;
  /** тонкая подпись под кадром; есть не у каждой плитки — так задаётся ритм */
  caption: string | null;
  /** настоящая пропорция кадра для aspect-ratio — кадр не кропится */
  ratio: string;
  /** во всю ширину доски, поверх всех колонок — акцент раз в несколько рядов */
  wide: boolean;
}

// Размеры плиток по кругу: одиночные кадры вперемешку с мини-галереями.
// Ряд неровный именно из-за чередования — не трогать «для порядка».
const SIZES = [1, 2, 1, 1, 3, 1, 2, 1];

/** сколько кадров берём с одной площадки: 4 площадки × 9 ≈ 24 плитки доски */
const PER_VENUE = 9;

// Пропорция — настоящая, из файла: как в Pinterest, высоту плитки диктует
// сам кадр, ничего не режется. Всё, что не влезает в рабочий диапазон
// (панорама в узкой колонке, вертикальная «полоска»), мягко прижимаем.
const MIN_RATIO = 0.6;
const MAX_RATIO = 1.6;

// Каждый N-й горизонтальный кадр уходит во всю ширину доски: он ложится
// поперёк всех колонок и ломает регулярность рядов. Горизонтальному там
// самое место — в одной колонке он мельче всех.
const WIDE_EVERY = 3;

function buildPins(venue: (typeof VENUES)[number], lane: number): Pin[] {
  const shots = venue.gallery.slice(0, PER_VENUE);
  const href = `/${venue.citySlug}/${venue.categorySlug}/${venue.slug}/`;
  const pins: Pin[] = [];

  let i = 0;
  let s = 0;
  // счётчик горизонтальных со сдвигом по площадке — широкие кадры разных
  // площадок не встают друг под другом
  let landscapes = lane;

  while (i < shots.length) {
    const size = Math.min(SIZES[s++ % SIZES.length], shots.length - i);
    const group = shots.slice(i, i + size);
    i += size;

    const first = resolveImage(group[0].src);
    const real = first.width / first.height;
    const ratio = Math.min(MAX_RATIO, Math.max(MIN_RATIO, real));
    const wide = real > 1.15 && landscapes++ % WIDE_EVERY === 0;

    pins.push({
      photos: group.map((g) => g.src),
      alt: group[0].alt,
      href,
      // Подписываем только мини-галереи: подпись у каждой плитки
      // превращает доску в каталог, а тут нужен именно поток кадров.
      caption: group.length > 1 ? venue.name : null,
      ratio: `${ratio.toFixed(3)} / 1`,
      wide,
    });
  }

  return pins;
}

/** Плитки всех площадок вперемешку: по одной с каждой по кругу, чтобы
 *  доска не шла блоками «сначала одна площадка, потом другая». */
export function collectPins(): Pin[] {
  const lanes = VENUES.map((venue, n) => buildPins(venue, n));
  const out: Pin[] = [];

  for (let k = 0; lanes.some((lane) => k < lane.length); k++) {
    for (const lane of lanes) {
      if (lane[k]) out.push(lane[k]);
    }
  }

  return out;
}
