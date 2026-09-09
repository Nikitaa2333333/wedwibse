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
import { REELS, reelHref } from '../data/reels';
import { FEED } from '../data/feed';
import { FOTOGRAFY, specialistUrl, type Specialist } from '../data/specialists';
import { frameId, isPortrait, ratioOf } from './media';

/** ЧЕЙ КАДР — подпись под фотографией в просмотре на весь экран
 *  (PhotoMasonry → lib/viewer). Ровно тот набор, что уже стоит на карточке
 *  каталога: имя, строка под именем (город у площадки, tagline у
 *  специалиста — как в vcard/scard) и звезда рейтинга. Нового не придумываем. */
export interface PinOwner {
  name: string;
  meta: string;
  /** нет собранных отзывов — нет и звезды (демо-рейтинг рисовать нельзя) */
  rating: number | null;
  /** сколько отзывов стоит за рейтингом — рядом со звездой в просмотре */
  reviews: number | null;
}

export interface Pin {
  /** источник кадра для подписи в просмотре; у плитки без карточки — null */
  owner: PinOwner | null;
  /** один кадр — статичная плитка, несколько — мини-галерея с точками */
  photos: string[];
  alt: string;
  /** ссылка на карточку-источник; у видео-кадра общего потока её нет */
  href: string | null;
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

// Совсем узкую вертикаль («полоску») прижимаем: в колонке она вырастает
// на два экрана и рвёт ритм.
const MIN_RATIO = 0.6;

// ВЕТКА-ПРЕВЬЮ: подписи под кадрами сняты (см. PhotoMasonry), поэтому
// их высота (CAPTION_H) из раскладки убрана — иначе жадный алгоритм
// резервировал бы место под текст, которого нет, и колонки расходились бы.
// caption в данных остался: из него берётся имя для «Избранного».

// Строка точек-индикаторов под кадром (есть только у плиток с несколькими
// кадрами) в тех же долях ширины колонки: зазор --s-2 плюс сама точка при
// колонке ~190px. Не учтёшь — колонки с мини-галереями незаметно вырастают
// и жадная раскладка начинает промахиваться.
const DOTS_H = 0.07;

type Venue = (typeof VENUES)[number];
type Shot = { src: string; alt: string };

/** Рейтинг площадки живёт в ленте каталога (data/feed), не в карточке:
 *  берём оттуда, а у площадки без записи в ленте звезды просто нет. */
function venueOwner(venue: Venue): PinOwner {
  const row = FEED.find((f) => f.kind === 'venue' && f.slug === venue.slug);
  const known = row?.kind === 'venue' ? row : null;
  return { name: venue.name, meta: venue.city, rating: known?.rating ?? null, reviews: known?.reviews ?? null };
}

function specialistOwner(s: Specialist): PinOwner {
  return { name: s.name, meta: s.tagline, rating: s.rating ?? null, reviews: s.reviews ?? null };
}

function makePin(group: Shot[], venue: Venue, ratio: number, caption: string | null): Pin {
  return {
    owner: venueOwner(venue),
    photos: group.map((g) => g.src),
    alt: group[0].alt,
    // Якорь читает VenueHero на клиенте: сборка статическая, и какой кадр
    // спросили, на сервере знать неоткуда. Без якоря (или с неизвестным
    // кадром) карточка открывается как раньше, первым кадром.
    href: `/${venue.citySlug}/${venue.categorySlug}/${venue.slug}/#foto-${frameId(group[0].src)}`,
    caption,
    ratio: `${ratio.toFixed(3)} / 1`,
    index: 0, // проставится при сборке секций
    height: 1 / ratio + (group.length > 1 ? DOTS_H : 0),
  };
}

/** Вертикальные и квадратные кадры площадки, собранные в плитки колонок */
function tallPins(venue: Venue): Pin[] {
  const shots = venue.gallery.slice(0, PER_VENUE).filter((s) => isPortrait(s.src));
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

/** Видео-кадры общего потока (data/reels.ts): такие же плитки, как фото,
 *  и ведут туда же — на визитку автора, открытую НА ЭТОМ РОЛИКЕ (якорь
 *  #foto-<slug>, его разбирает HeroStage).
 *
 *  Ролик без ссылки был тупиком: человек жмёт на кадр, а тот не отвечает —
 *  единственная плитка доски, которая никуда не ведёт. Автор у каждого
 *  ролика проставлен честно (author в data/reels.ts: весь нынешний набор
 *  снят Лешаковыми, они же его и отдали), так что вести на его визитку —
 *  не подделка выдачи, а ровно то, чем ролик является: работой подрядчика.
 *  Появится ролик без автора — reelHref вернёт null, и плитка снова будет
 *  просто кадром без перехода. */
function reelPins(): Pin[] {
  return REELS.map((reel) => ({
    owner: null,
    photos: [reel.src],
    alt: reel.alt,
    href: reelHref(reel),
    caption: null,
    ratio: `${ratioOf(reel.src).toFixed(3)} / 1`,
    index: 0,
    height: 1 / ratioOf(reel.src),
  }));
}

/** сколько кадров берём с карточки одного специалиста */
const PER_SPECIALIST = 12;

/** Кадры специалиста — второй источник доски рядом с площадками: подрядчик
 *  со своей карточкой попадает на главную сам, без правок вёрстки.
 *  Правило то же: только вертикальные кадры, подпись — у мини-галерей. */
function specialistPins(s: Specialist): Pin[] {
  const shots = s.photos.slice(0, PER_SPECIALIST).filter(isPortrait);
  const pins: Pin[] = [];

  let i = 0;
  let n = 0;

  while (i < shots.length) {
    const size = Math.min(SIZES[n++ % SIZES.length], shots.length - i);
    const group = shots.slice(i, i + size);
    i += size;

    pins.push({
      owner: specialistOwner(s),
      photos: group,
      alt: `${s.name} — свадебная съёмка`,
      // как у площадок: открываем визитку НА ТОМ кадре, по которому нажали
      href: `${specialistUrl(s)}#foto-${frameId(group[0])}`,
      caption: group.length > 1 ? s.name : null,
      ratio: `${Math.max(MIN_RATIO, ratioOf(group[0])).toFixed(3)} / 1`,
      index: 0,
      height:
        1 / Math.max(MIN_RATIO, ratioOf(group[0])) +
        (group.length > 1 ? DOTS_H : 0),
    });
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
  // Ролики и кадры подрядчиков идут своими дорожками в том же interleave —
  // так они расходятся по всему потоку, а не встают пачкой плиток подряд.
  const photos = interleave([
    ...VENUES.map(tallPins),
    ...FOTOGRAFY.map(specialistPins),
    reelPins(),
  ]);
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

/** Плитки доски из простого списка кадров — галерея карточки подрядчика.
 *  Тут нет ни мини-галерей, ни подписей, ни статей: подпись под каждым
 *  кадром своей же съёмки — шум, а не смысл. Единственное, что берём
 *  от доски главной, — настоящую пропорцию файла и тот же зажим совсем
 *  узкой вертикали (MIN_RATIO): в колонке она вырастает на два экрана.
 *
 *  Горизонтальные кадры тут, в отличие от доски главной, остаются:
 *  там они отсеиваются потому, что доска — витрина каталога и марка среди
 *  вертикалей выглядит ошибкой, а здесь это ПОРТФОЛИО подрядчика — прятать
 *  часть его съёмки ради ровного ритма нельзя. В масонри горизонтальный
 *  кадр просто становится низкой плиткой, колонки он не рвёт.
 */
export function photoTiles(photos: string[], alt: string): Tile[] {
  return photos.map((src, index) => {
    const ratio = Math.max(MIN_RATIO, ratioOf(src));

    return {
      kind: 'photo',
      owner: null,
      photos: [src],
      alt: `${alt} — фото ${index + 1}`,
      href: null,
      caption: null,
      ratio: `${ratio.toFixed(3)} / 1`,
      index,
      height: 1 / ratio,
    };
  });
}

// ЖАДНАЯ РАСКЛАДКА — тот же алгоритм, что у Masonry.js/MiniMasonry:
// каждая следующая плитка ложится в самую короткую на этот момент колонку.
// Стыки внутри колонки ровные всегда. Не CSS multi-column: тот «балансирует»
// колонки по высоте и заканчивает их с разницей в пару пикселей — читается
// как ошибка, а не как ритм. Колонки одной ширины, поэтому высоты считаются
// в её долях и сходятся с реальными до пикселя. Тем же кодом раскладывает
// клиент (PhotoMasonry), когда колонок на экране больше двух.
export function layoutColumns(pins: Tile[], count: number): Tile[][] {
  const cols: Tile[][] = Array.from({ length: count }, () => []);
  const tall = new Array<number>(count).fill(0);

  // Статьи идут по колонкам по кругу — первая слева, вторая справа, дальше
  // снова слева: плашка-текст не должна копиться на одной вертикали, но и
  // выбирать ей колонку жадно нельзя — тогда все статьи сваливаются в одну.
  let article = 0;

  for (const p of pins) {
    let k = article % count;

    if (p.kind === 'article') {
      article++;
    } else {
      k = 0;
      for (let j = 1; j < count; j++) if (tall[j] < tall[k]) k = j;
    }

    cols[k].push(p);
    tall[k] += p.height;
  }

  return cols;
}
