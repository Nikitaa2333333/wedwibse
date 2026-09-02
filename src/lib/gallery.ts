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
  /** порядок в потоке; по нему клиент перекладывает доску под другое число колонок */
  index: number;
  /** высота плитки в долях ширины колонки (кадр + подпись) — для жадной раскладки */
  height: number;
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

// Подпись под плиткой в долях ширины колонки (кегль сноски + отступ при
// колонке ~190px). Нужна только жадной раскладке, чтобы колонка с подписями
// не вырастала незаметно; на сам зазор не влияет.
const CAPTION_H = 0.14;

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
    const ratio = Math.min(MAX_RATIO, Math.max(MIN_RATIO, first.width / first.height));
    const caption = group.length > 1 ? venue.name : null;

    pins.push({
      photos: group.map((g) => g.src),
      alt: group[0].alt,
      href,
      // Подписываем только мини-галереи: подпись у каждой плитки
      // превращает доску в каталог, а тут нужен именно поток кадров.
      caption,
      ratio: `${ratio.toFixed(3)} / 1`,
      index: 0, // проставится в collectPins после перемешивания
      height: 1 / ratio + (caption ? CAPTION_H : 0),
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

  return out.map((pin, index) => ({ ...pin, index }));
}

// ЖАДНАЯ РАСКЛАДКА — тот же алгоритм, что у Masonry.js/MiniMasonry:
// каждая следующая плитка ложится в самую короткую на этот момент колонку.
// Стыки внутри колонки ровные всегда, низ доски — честно рваный.
// Не CSS multi-column: тот «балансирует» колонки по высоте и заканчивает
// их с разницей в пару пикселей — выглядит как ошибка, а не как ритм.
// Колонки одной ширины, поэтому высоты считаются в её долях и сходятся
// с реальными до пикселя. Тем же кодом раскладывает клиент (PhotoBoard),
// когда колонок на экране больше двух.
export function layoutColumns(pins: Pin[], count: number): Pin[][] {
  const cols: Pin[][] = Array.from({ length: count }, () => []);
  const tall = new Array<number>(count).fill(0);

  for (const pin of pins) {
    let k = 0;
    for (let j = 1; j < count; j++) if (tall[j] < tall[k]) k = j;
    cols[k].push(pin);
    tall[k] += pin.height;
  }

  return cols;
}
