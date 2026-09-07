// ============================================================
// ВИДЕО-КАДРЫ ОБЩЕГО ПОТОКА.
// Доска на главной — единый поток фотографий и видео: ролик лежит в нём
// такой же плиткой, как снимок, без ярлыка «видео» и без отдельной секции.
// Поэтому ролики, не принадлежащие конкретной площадке, живут здесь, а не
// в gallery карточки: подмешать чужой кадр к площадке — соврать в выдаче.
//
// Ролик — немой луп 8 секунд (правила и пайплайн — VIDEO.md): со звуком
// автозапуск не работает нигде. Файл в public/reels/, постер тем же именем
// в src/assets/reels/.
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
  /** slug карточки специалиста, который это снял */
  author: string;
}

// Все ролики каталога сняты Лешаковыми (карточка leshakovy) — они же
// отдали материал для доски главной.
export const REELS: Reel[] = [
  { slug: 'stairs', src: '/reels/stairs.mp4', alt: 'Молодожёны на парадной лестнице', author: 'leshakovy' },
  { slug: 'groom', src: '/reels/groom.mp4', alt: 'Жених перед выходом к церемонии', author: 'leshakovy' },
  { slug: 'morning', src: '/reels/morning.mp4', alt: 'Утро невесты', author: 'leshakovy' },
  { slug: 'rings', src: '/reels/rings.mp4', alt: 'Кольца перед церемонией', author: 'leshakovy' },
  { slug: 'bride-door', src: '/reels/bride-door.mp4', alt: 'Невеста в дверях, чёрно-белый кадр', author: 'leshakovy' },
  { slug: 'ballroom', src: '/reels/ballroom.mp4', alt: 'Невеста в бальном платье в дворцовом зале', author: 'leshakovy' },
  { slug: 'pier', src: '/reels/pier.mp4', alt: 'Площадка на воде с высоты', author: 'leshakovy' },
  { slug: 'terrace', src: '/reels/terrace.mp4', alt: 'Пара на террасе загородного клуба', author: 'leshakovy' },
  { slug: 'city', src: '/reels/city.mp4', alt: 'Городская прогулка пары', author: 'leshakovy' },
  { slug: 'suite', src: '/reels/suite.mp4', alt: 'Утро пары в номере', author: 'leshakovy' },
  { slug: 'rose', src: '/reels/rose.mp4', alt: 'Букет и украшения невесты крупным планом', author: 'leshakovy' },
  { slug: 'balcony', src: '/reels/balcony.mp4', alt: 'Невеста с букетом на балконе', author: 'leshakovy' },
];

/** ролики одного подрядчика — они же кадры первого экрана его визитки */
export function reelsOf(slug: string): Reel[] {
  return REELS.filter((r) => r.author === slug);
}

/** Куда ведёт плитка ролика из доски: визитка автора, открытая НА ЭТОМ
 *  ролике. Якорь тот же, что у кадров площадки, — `#foto-<имя файла>`. */
export function reelHref(reel: Reel): string | null {
  const author = findSpecialist(reel.author);
  return author ? `${specialistUrl(author)}#foto-${reel.slug}` : null;
}
