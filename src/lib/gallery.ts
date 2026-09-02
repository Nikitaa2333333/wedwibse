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
  /** форма плитки для aspect-ratio — из шкалы высот, а не из файла */
  ratio: string;
}

// Размеры плиток по кругу: одиночные кадры вперемешку с мини-галереями.
// Ряд неровный именно из-за чередования — не трогать «для порядка».
const SIZES = [1, 2, 1, 1, 3, 1, 2, 1];

/** сколько кадров берём с одной площадки: 4 площадки × 9 ≈ 24 плитки доски */
const PER_VENUE = 9;

// ШКАЛА ВЫСОТ. Пропорцию не берём из файла напрямую: почти все исходники
// каталога — ровно 3:2 и 2:3, и доска из них выходит полосатой (две высоты
// через одну). Плитке назначается форма из набора — соседние по колонке
// заведомо разной высоты, ряды не сходятся, и это и есть ритм доски.
// Кадр внутри режется по cover, поэтому форму выбираем по «характеру»
// оригинала: горизонтальному — из широкого набора, вертикальному — из
// вертикального, иначе от снимка остаётся середина.
const WIDE_SHAPES = ['4 / 3', '1 / 1', '5 / 4', '4 / 3', '1 / 1'];
const TALL_SHAPES = ['3 / 4', '2 / 3', '4 / 5', '5 / 7', '3 / 4', '1 / 1'];

function buildPins(venue: (typeof VENUES)[number], lane: number): Pin[] {
  const shots = venue.gallery.slice(0, PER_VENUE);
  const href = `/${venue.citySlug}/${venue.categorySlug}/${venue.slug}/`;
  const pins: Pin[] = [];

  let i = 0;
  let s = 0;

  while (i < shots.length) {
    const size = Math.min(SIZES[s++ % SIZES.length], shots.length - i);
    const group = shots.slice(i, i + size);
    i += size;

    const first = resolveImage(group[0].src);
    // сдвиг по площадке (lane) — чтобы соседи по ряду не получали одну форму
    const step = pins.length + lane;
    const shapes = first.width / first.height > 1.15 ? WIDE_SHAPES : TALL_SHAPES;
    const ratio = shapes[step % shapes.length];

    pins.push({
      photos: group.map((g) => g.src),
      alt: group[0].alt,
      href,
      // Подписываем только мини-галереи: подпись у каждой плитки
      // превращает доску в каталог, а тут нужен именно поток кадров.
      caption: group.length > 1 ? venue.name : null,
      ratio,
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
