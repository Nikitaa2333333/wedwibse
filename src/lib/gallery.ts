// ============================================================
// ДОСКА КАДРОВ ГЛАВНОЙ — пул фотографий всего каталога.
// Галерея на главной не привязана к одной площадке: сюда стекается
// gallery каждой карточки из VENUES, поэтому новая площадка попадает
// на главную сама, без правок вёрстки. Появятся подрядчики со своими
// кадрами — тем же способом добавится ещё один источник.
//
// ДОСКА ТОЛЬКО ИЗ ВЕРТИКАЛЬНЫХ И КВАДРАТНЫХ КАДРОВ. Горизонтальный
// снимок в узкой колонке выглядит маркой, а полосой во всю ширину рвёт
// колонки на блоки — и над полосой остаются дыры разной высоты. Убрать
// такие кадры из доски дешевле, чем чинить последствия: вертикальных
// в каталоге втрое больше, доска держится на них.
//
// Плитка (Pin) может нести несколько кадров: тогда в ней работает
// PhotoRail — точки-индикаторы и листание свайпом, как в карточке
// каталога. Пропорция всегда настоящая, из файла: кадр не кропится.
//
// СТАТЬИ ЛЕЖАТ В ТОМ ЖЕ ПОТОКЕ. Раз в ARTICLE_EVERY плиток в доску
// вклинивается карточка статьи — так блог попадается сам собой, пока
// человек листает фотографии (воронка «статья → подборка → карточка»
// из SEO.md). Отдельной полосой во всю ширину статьи не ставим: полоса
// рвёт колонки на блоки и оставляет над собой дыры разной высоты.
// ============================================================
import { VENUES } from '../data/venues';
import { ARTICLES, articleUrl, rubricBySlug } from '../data/articles';
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

// Размеры плиток по кругу: одиночные кадры вперемешку с мини-галереями.
// Ряд неровный именно из-за чередования — не трогать «для порядка».
const SIZES = [1, 2, 1, 1, 3, 1, 2, 1];

/** сколько кадров берём с одной площадки */
const PER_VENUE = 16;

/** горизонтальным считаем всё, что шире квадрата: такой кадр в доску не идёт */
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

/** Вертикальные и квадратные кадры площадки, собранные в плитки колонок */
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

/** Статья в потоке доски — типографическая плашка: рубрика, заголовок,
 *  «Читать». Без обложки: фото статьи в узкой колонке сливалось с соседними
 *  кадрами, а подпись под ним — с подписью соседней плитки. Плашка той же
 *  пропорции, что кадр каталога, встаёт в ритм доски как текстовый пин. */
export interface ArticleTile {
  kind: 'article';
  href: string;
  rubric: string;
  title: string;
  ratio: string;
  index: number;
  height: number;
}

export type Tile = ({ kind: 'photo' } & Pin) | ArticleTile;

/** через сколько фото-плиток в поток вклинивается статья */
const ARTICLE_EVERY = 5;

// Пропорция плашки статьи = кадр каталога на телефоне (--card-ratio 2:3):
// в колонке из вертикальных кадров она читается как ещё один кадр.
const ARTICLE_RATIO = 2 / 3;

function articleTile(article: (typeof ARTICLES)[number]): ArticleTile {
  return {
    kind: 'article',
    href: articleUrl(article),
    rubric: rubricBySlug(article.rubricSlug)?.title ?? 'Журнал',
    title: article.title,
    ratio: '2 / 3',
    index: 0,
    height: 1 / ARTICLE_RATIO,
  };
}

/** Доска целиком — один непрерывный поток плиток, без блоков и полос:
 *  колонки просто идут вниз и заканчиваются на разной высоте, как в ленте.
 *  Каждая ARTICLE_EVERY-я позиция — карточка статьи. */
export function collectTiles(): Tile[] {
  const photos = interleave(VENUES.map(tallPins));
  const articles = ARTICLES.map(articleTile);
  const out: Tile[] = [];

  let a = 0;

  photos.forEach((pin, i) => {
    // статью ставим ПЕРЕД плиткой, чтобы доска не начиналась с неё
    if (i > 0 && i % ARTICLE_EVERY === 0 && articles[a]) out.push(articles[a++]);
    out.push({ kind: 'photo', ...pin });
  });

  return out.map((tile, index) => ({ ...tile, index }));
}

// ЖАДНАЯ РАСКЛАДКА — тот же алгоритм, что у Masonry.js/MiniMasonry:
// каждая следующая плитка ложится в самую короткую на этот момент колонку.
// Стыки внутри колонки ровные всегда. Не CSS multi-column: тот «балансирует»
// колонки по высоте и заканчивает их с разницей в пару пикселей — читается
// как ошибка, а не как ритм. Колонки одной ширины, поэтому высоты считаются
// в её долях и сходятся с реальными до пикселя. Тем же кодом раскладывает
// клиент (PhotoBoard), когда колонок на экране больше двух.
export function layoutColumns(pins: Tile[], count: number): Tile[][] {
  const cols: Tile[][] = Array.from({ length: count }, () => []);
  const tall = new Array<number>(count).fill(0);

  for (const p of pins) {
    let k = 0;
    for (let j = 1; j < count; j++) if (tall[j] < tall[k]) k = j;
    cols[k].push(p);
    tall[k] += p.height;
  }

  return cols;
}
