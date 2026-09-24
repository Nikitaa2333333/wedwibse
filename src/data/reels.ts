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
  // Реальные подрядчики (диски заказчика, лупы по VIDEO.md)
  { slug: 'suhorada-bikers', src: '/reels/suhorada-bikers.mp4', alt: 'Пара в кожаных куртках на мотоцикле у кирпичного завода', author: 'suhorada', sound: true },
  { slug: 'suhorada-palace', src: '/reels/suhorada-palace.mp4', alt: 'Молодожёны у дворцовой лестницы', author: 'suhorada', sound: true },
  { slug: 'suhorada-hotel', src: '/reels/suhorada-hotel.mp4', alt: 'Утро невесты в номере: платье и лепестки', author: 'suhorada', sound: true },
  { slug: 'nirvani-backstage', src: '/reels/nirvani-backstage.mp4', alt: 'Даша Нирвани на съёмке: за камерой и на площадке с парой', author: 'nirvani', sound: true },
  { slug: 'solnechnaya-mic', src: '/reels/solnechnaya-mic.mp4', alt: 'Ольга Солнечная с микрофоном ведёт свадьбу в зале', author: 'solnechnaya', sound: true },
  { slug: 'solnechnaya-dance', src: '/reels/solnechnaya-dance.mp4', alt: 'Вручение подарка и танец невесты с отцом на банкете', author: 'solnechnaya', sound: true },
  { slug: 'galkin-hall', src: '/reels/galkin-hall.mp4', alt: 'Михаил Галкин ведёт банкет в зале', author: 'galkin', sound: true },
  { slug: 'galkin-mic', src: '/reels/galkin-mic.mp4', alt: 'Ведущий с микрофоном на танцполе', author: 'galkin', sound: true },
  { slug: 'galkin-suit', src: '/reels/galkin-suit.mp4', alt: 'Михаил Галкин у фотозоны выездной регистрации', author: 'galkin', sound: true },
  { slug: 'galkin-ceremony', src: '/reels/galkin-ceremony.mp4', alt: 'Выездная регистрация: гости встречают пару', author: 'galkin', sound: true },
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
  // Подписи сверены с роликами 24.09.2026: до этого стояли вперемешку,
  // а reel-11/12 были копиями reel-09/10. Исходники — research/reel-map.json.
  { slug: 'reel-01', src: '/venues/forest-dew/reel-01.mp4', alt: 'Пара в лесу, церемония под драпировками и первый танец', author: '', venue: 'forest-dew', sound: true },
  { slug: 'reel-02', src: '/venues/forest-dew/reel-02.mp4', alt: 'Оранжерея ночью, коктейли и огонь на подаче', author: '', venue: 'forest-dew', sound: true },
  { slug: 'reel-03', src: '/venues/forest-dew/reel-03.mp4', alt: 'Жених надевает кольцо невесте под драпировками', author: '', venue: 'forest-dew', sound: true },
  { slug: 'reel-04', src: '/venues/forest-dew/reel-04.mp4', alt: 'Выездная церемония в лесу, гости на поляне', author: '', venue: 'forest-dew', sound: true },
  { slug: 'reel-05', src: '/venues/forest-dew/reel-05.mp4', alt: 'Тост гостьи и дартс вместо битья посуды', author: '', venue: 'forest-dew', sound: true },
  { slug: 'reel-06', src: '/venues/forest-dew/reel-06.mp4', alt: 'Невеста в пышном платье и вечеринка в оранжерее', author: '', venue: 'forest-dew', sound: true },
  { slug: 'reel-07', src: '/venues/forest-dew/reel-07.mp4', alt: 'Вечерний банкет с красной подсветкой, гости в шубах', author: '', venue: 'forest-dew', sound: true },
  { slug: 'reel-08', src: '/venues/forest-dew/reel-08.mp4', alt: 'Официанты несут блюда по дорожке в лесу', author: '', venue: 'forest-dew', sound: true },
  { slug: 'reel-09', src: '/venues/forest-dew/reel-09.mp4', alt: 'Дедушка жениха читает стих в микрофон', author: '', venue: 'forest-dew', sound: true },
  { slug: 'reel-10', src: '/venues/forest-dew/reel-10.mp4', alt: 'Оранжерея с высоты, фишка свадьбы', author: '', venue: 'forest-dew', sound: true },
  { slug: 'reel-11', src: '/venues/forest-dew/reel-11.mp4', alt: 'Оранжерея среди сосен, четыре свадебных сезона', author: '', venue: 'forest-dew', sound: true },
  { slug: 'reel-12', src: '/venues/forest-dew/reel-12.mp4', alt: 'Пара на пруду и костровая зона', author: '', venue: 'forest-dew', sound: true },
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
