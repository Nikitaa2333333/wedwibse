// ============================================================
// ДОСКА КАДРОВ ГЛАВНОЙ — пул фотографий всего каталога.
// Галерея на главной не привязана к одной площадке: сюда стекается
// gallery каждой карточки из VENUES, поэтому новая площадка попадает
// на главную сама, без правок вёрстки. Появятся подрядчики со своими
// кадрами — тем же способом добавится ещё один источник.
//
// ФОРМА КАДРА РЕШАЕТ, КУДА ОН ЛЯЖЕТ. Вертикальные и квадратные идут
// в колонки масонри — их большинство, и доска держится на них.
// Горизонтальный кадр в узкой колонке выглядит маркой, поэтому такие
// снимки работают полосой во всю ширину экрана между блоками колонок.
// Полос немного (STRIP_EVERY): вертикаль в каталоге главнее.
//
// Плитка (Pin) может нести несколько кадров: тогда в ней работает
// PhotoRail — точки-индикаторы и листание свайпом, как в карточке
// каталога. Пропорция всегда настоящая, из файла: кадр не кропится.
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
  /** порядок в блоке; по нему клиент перекладывает доску под другое число колонок */
  index: number;
  /** высота плитки в долях ширины колонки (кадр + подпись) — для жадной раскладки */
  height: number;
}

/** Блок колонок или полоса во всю ширину — из них собирается доска */
export type Section = { kind: 'grid'; pins: Pin[] } | { kind: 'strip'; pin: Pin };

// Размеры плиток по кругу: одиночные кадры вперемешку с мини-галереями.
// Ряд неровный именно из-за чередования — не трогать «для порядка».
const SIZES = [1, 2, 1, 1, 3, 1, 2, 1];

/** сколько кадров берём с одной площадки */
const PER_VENUE = 16;

/** через сколько плиток колонок ставим полосу во всю ширину */
const STRIP_EVERY = 9;

/** горизонтальным считаем всё, что шире квадрата: такому кадру место в полосе */
const LANDSCAPE = 1.05;

// Совсем узкую вертикаль («полоску») прижимаем: в колонке она вырастает
// на два экрана и рвёт ритм.
const MIN_RATIO = 0.6;

// Подпись под плиткой в долях ширины колонки (кегль сноски + отступ при
// колонке ~190px). Нужна жадной раскладке, чтобы колонка с подписями
// не вырастала незаметно; на сам зазор не влияет.
const CAPTION_H = 0.12;

type Venue = (typeof VENUES)[number];
type Shot = { src: string; alt: string };

function makePin(group: Shot[], venue: Venue, ratio: number, caption: string | null): Pin {
  return {
    photos: group.map((g) => g.src),
    alt: group[0].alt,
    href: `/${venue.citySlug}/${venue.categorySlug}/${venue.slug}/`,
    caption,
    ratio: `${ratio.toFixed(3)} / 1`,
    index: 0, // проставится при сборке секций
    height: 1 / ratio + (caption ? CAPTION_H : 0),
  };
}

function ratioOf(src: string): number {
  const meta = resolveImage(src);
  return meta.width / meta.height;
}

/** Вертикальные кадры площадки, собранные в плитки колонок */
function tallPins(venue: Venue): Pin[] {
  const shots = venue.gallery.slice(0, PER_VENUE).filter((s) => ratioOf(s.src) <= LANDSCAPE);
  const pins: Pin[] = [];

  let i = 0;
  let s = 0;

  while (i < shots.length) {
    const size = Math.min(SIZES[s++ % SIZES.length], shots.length - i);
    const group = shots.slice(i, i + size);
    i += size;

    // Подписываем только мини-галереи: подпись у каждой плитки
    // превращает доску в каталог, а тут нужен именно поток кадров.
    const caption = group.length > 1 ? venue.name : null;
    pins.push(makePin(group, venue, Math.max(MIN_RATIO, ratioOf(group[0].src)), caption));
  }

  return pins;
}

/** Горизонтальные кадры площадки — кандидаты в полосы во всю ширину */
function stripPins(venue: Venue): Pin[] {
  return venue.gallery
    .slice(0, PER_VENUE)
    .filter((s) => ratioOf(s.src) > LANDSCAPE)
    .map((s) => makePin([s], venue, ratioOf(s.src), venue.name));
}

/** по одной штуке с каждой площадки по кругу — доска не идёт блоками
 *  «сначала одна площадка, потом другая» */
function interleave(lanes: Pin[][]): Pin[] {
  const out: Pin[] = [];

  for (let k = 0; lanes.some((lane) => k < lane.length); k++) {
    for (const lane of lanes) {
      if (lane[k]) out.push(lane[k]);
    }
  }

  return out;
}

/** Доска целиком: блоки колонок, разделённые полосами во всю ширину. */
export function collectSections(): Section[] {
  const pins = interleave(VENUES.map(tallPins));
  const strips = interleave(VENUES.map(stripPins));
  const sections: Section[] = [];

  let s = 0;

  for (let i = 0; i < pins.length; i += STRIP_EVERY) {
    sections.push({
      kind: 'grid',
      pins: pins.slice(i, i + STRIP_EVERY).map((p, index) => ({ ...p, index })),
    });

    // полоса — только между блоками: доска не заканчивается полосой
    if (i + STRIP_EVERY < pins.length && strips[s]) {
      sections.push({ kind: 'strip', pin: strips[s++] });
    }
  }

  return sections;
}

// ЖАДНАЯ РАСКЛАДКА — тот же алгоритм, что у Masonry.js/MiniMasonry:
// каждая следующая плитка ложится в самую короткую на этот момент колонку.
// Стыки внутри колонки ровные всегда. Не CSS multi-column: тот «балансирует»
// колонки по высоте и заканчивает их с разницей в пару пикселей — читается
// как ошибка, а не как ритм. Колонки одной ширины, поэтому высоты считаются
// в её долях и сходятся с реальными до пикселя. Тем же кодом раскладывает
// клиент (PhotoBoard), когда колонок на экране больше двух.
export function layoutColumns(pins: Pin[], count: number): Pin[][] {
  const cols: Pin[][] = Array.from({ length: count }, () => []);
  const tall = new Array<number>(count).fill(0);

  for (const p of pins) {
    let k = 0;
    for (let j = 1; j < count; j++) if (tall[j] < tall[k]) k = j;
    cols[k].push(p);
    tall[k] += p.height;
  }

  return cols;
}
