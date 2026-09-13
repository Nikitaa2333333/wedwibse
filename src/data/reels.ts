// ============================================================
// ВИДЕО-КАДРЫ ОБЩЕГО ПОТОКА.
// Доска на главной — единый поток фотографий и видео: ролик лежит в нём
// такой же плиткой, как снимок, без ярлыка «видео» и без отдельной секции.
// Поэтому ролики, не принадлежащие конкретной площадке, живут здесь, а не
// в gallery карточки: подмешать чужой кадр к площадке — соврать в выдаче.
//
// Ролик — луп 8 секунд (правила и пайплайн — VIDEO.md). ИГРАЕТ ОН ВСЕГДА
// НЕМЫМ: автозапуск со звуком запрещён во всех браузерах, и это не наше
// решение. Но если у файла есть дорожка (sound: true), над кадром стоит
// кнопка звука — нажал, и тот же самый файл зазвучал, ничего дополнительно
// не загружая. Файл в public/reels/, постер тем же именем в src/assets/reels/.
//
// АВТОР У РОЛИКА ОБЯЗАТЕЛЕН (author — slug карточки специалиста).
// Отдельной страницы у ролика нет и не нужно: нажатие на плитку в доске
// открывает ВИЗИТКУ автора, и её первый экран сразу стоит на этом самом
// ролике — тем же якорем `#foto-<кадр>`, которым открывается нужный кадр
// площадки. Один экран вместо двух: человек видит и ролик, и того, кто
// его снял, а не промежуточную страницу с одним видео.
// ============================================================
import { findSpecialist, specialistUrl } from './specialists';

export interface Reel {
  /** slug: имя файла ролика и якорь кадра на визитке автора */
  slug: string;
  /** немой луп для доски; постер — тот же путь с расширением .webp */
  src: string;
  alt: string;
  /** slug карточки специалиста, который это снял; у роликов площадки —
   *  пусто, автор там сама площадка (см. venue) */
  author: string;
  /** slug площадки: ролик из её материалов, плитка ведёт на её карточку.
   *  Ролики площадок лежат в public/venues/<slug>/reel-NN.mp4, постеры
   *  рядом с фото в src/assets/venues/<slug>/ (пайплайн — scripts/prep-video.mjs) */
  venue?: string;
  /** у ролика есть звуковая дорожка — значит и кнопка звука над кадром.
   *  Стоит не у всех: часть демо-набора пришла уже немой, исходников
   *  со звуком к ним нет (пайплайн — VIDEO.md). */
  sound?: true;
}

// Все ролики каталога сняты Лешаковыми (карточка leshakovy) — они же
// отдали материал для доски главной.
export const REELS: Reel[] = [
  { slug: 'stairs', src: '/reels/stairs.mp4', alt: 'Молодожёны на парадной лестнице', author: 'leshakovy', sound: true },
  { slug: 'groom', src: '/reels/groom.mp4', alt: 'Жених перед выходом к церемонии', author: 'leshakovy', sound: true },
  { slug: 'morning', src: '/reels/morning.mp4', alt: 'Утро невесты', author: 'leshakovy', sound: true },
  { slug: 'rings', src: '/reels/rings.mp4', alt: 'Кольца перед церемонией', author: 'leshakovy' },
  { slug: 'bride-door', src: '/reels/bride-door.mp4', alt: 'Невеста в дверях, чёрно-белый кадр', author: 'leshakovy' },
  { slug: 'ballroom', src: '/reels/ballroom.mp4', alt: 'Невеста в бальном платье в дворцовом зале', author: 'leshakovy' },
  { slug: 'pier', src: '/reels/pier.mp4', alt: 'Площадка на воде с высоты', author: 'leshakovy' },
  { slug: 'terrace', src: '/reels/terrace.mp4', alt: 'Пара на террасе загородного клуба', author: 'leshakovy' },
  { slug: 'city', src: '/reels/city.mp4', alt: 'Городская прогулка пары', author: 'leshakovy' },
  { slug: 'suite', src: '/reels/suite.mp4', alt: 'Утро пары в номере', author: 'leshakovy' },
  { slug: 'rose', src: '/reels/rose.mp4', alt: 'Букет и украшения невесты крупным планом', author: 'leshakovy' },
  { slug: 'balcony', src: '/reels/balcony.mp4', alt: 'Невеста с букетом на балконе', author: 'leshakovy' },
  // ---- ролики площадок (материалы самих площадок, см. venue) ----
  { slug: 'reel-01', src: '/venues/due-to-love/reel-01.mp4', alt: 'Чёрная оранжерея «Из-за любви» в лесу, два свадебных сезона', author: '', venue: 'due-to-love', sound: true },
  { slug: 'reel-02', src: '/venues/due-to-love/reel-02.mp4', alt: 'Схемы и макеты рассадки в оранжерее', author: '', venue: 'due-to-love', sound: true },
  { slug: 'reel-03', src: '/venues/due-to-love/reel-03.mp4', alt: 'Драпировки и люстра над столами', author: '', venue: 'due-to-love', sound: true },
  { slug: 'reel-04', src: '/venues/due-to-love/reel-04.mp4', alt: 'Молодожёны с бокалами в оранжерее', author: '', venue: 'due-to-love', sound: true },
  { slug: 'reel-05', src: '/venues/due-to-love/reel-05.mp4', alt: 'Официант с подносом на банкете', author: '', venue: 'due-to-love', sound: true },
  { slug: 'reel-06', src: '/venues/due-to-love/reel-06.mp4', alt: 'Подача закусок и напитков', author: '', venue: 'due-to-love', sound: true },
  { slug: 'reel-07', src: '/venues/due-to-love/reel-07.mp4', alt: 'Невеста в платье в оранжерее', author: '', venue: 'due-to-love', sound: true },
  { slug: 'reel-08', src: '/venues/due-to-love/reel-08.mp4', alt: 'Оранжерея ночью в огнях гирлянд', author: '', venue: 'due-to-love', sound: true },
  { slug: 'reel-09', src: '/venues/due-to-love/reel-09.mp4', alt: 'Пара у фонтана в лесу', author: '', venue: 'due-to-love', sound: true },
  { slug: 'reel-10', src: '/venues/due-to-love/reel-10.mp4', alt: 'Сервировка с зеленью под драпировками', author: '', venue: 'due-to-love', sound: true },
  { slug: 'reel-11', src: '/venues/due-to-love/reel-11.mp4', alt: 'Молодожёны под зонтом в лесу', author: '', venue: 'due-to-love', sound: true },
  { slug: 'reel-12', src: '/venues/due-to-love/reel-12.mp4', alt: 'Невеста в кружевной фате', author: '', venue: 'due-to-love', sound: true },
  { slug: 'reel-01', src: '/venues/fish-point/reel-01.mp4', alt: 'Банкетный зал Fish Point в берёзовой роще с высоты', author: '', venue: 'fish-point', sound: true },
];

/** Есть ли у ролика звук — по пути файла: разметка (PhotoRail, HeroStage,
 *  ряд «Видео») знает только src кадра, а не всю запись. Кнопку звука
 *  рисуем ровно там, где дорожка действительно есть. */
const SOUNDED = new Set(REELS.filter((r) => r.sound).map((r) => r.src));

export function hasSound(src: string): boolean {
  return SOUNDED.has(src);
}

/** ролики площадки — ряд «Видео» на её карточке (блок reels) */
export function reelsOfVenue(slug: string): Reel[] {
  return REELS.filter((r) => r.venue === slug);
}

/** ролики одного подрядчика — они же кадры первого экрана его визитки */
export function reelsOf(slug: string): Reel[] {
  return REELS.filter((r) => r.author === slug);
}

/** Куда ведёт плитка ролика из доски: визитка автора, открытая НА ЭТОМ
 *  ролике. Якорь тот же, что у кадров площадки, — `#foto-<имя файла>`. */
export function reelHref(reel: Reel): string | null {
  if (reel.venue) return `/moskva/ploshchadki/${reel.venue}/#foto-${reel.slug}`;
  const author = findSpecialist(reel.author);
  return author ? `${specialistUrl(author)}#foto-${reel.slug}` : null;
}
