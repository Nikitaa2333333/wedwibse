// ТОЧКИ ДЛЯ КАРТЫ — единая сборка данных метки.
// Карта показывает то же, что карточка каталога (цена, рейтинг, фото), плюс
// координату из карточки площадки. Собираем в одном месте, чтобы страница
// каталога и любая другая страница с картой не склеивали эти два источника
// каждая по-своему.
//
// Площадка без contacts.geo на карту не попадает: координату проставляем
// руками при заведении карточки (клиентский геокодер — отдельный ключ и
// лишний запрос на каждую загрузку).
import { VENUES } from '../data/venues';
import { FEED, type FeedVenue } from '../data/feed';

export interface MapPoint {
  slug: string;
  name: string;
  /** [широта, долгота] — порядок, который ждёт Яндекс */
  coords: [number, number];
  address: string;
  href: string;
  price: string;
  /** цена в том виде, в каком она стоит НА МЕТКЕ (см. pinLabel) */
  label: string;
  city: string;
  capacity: string;
  rating: number | null;
  /** путь к фото строкой — прогоняется через resolveImage на выводе */
  photo: string;
}

/** ПОДПИСЬ МЕТКИ — только цена (см. .map-pin в global.css), а метка это
 *  капсула шириной в пару слов. Цифра («от 9 000 ₽») влезает как есть,
 *  а служебные формулировки каталога режем до сути: «цена по запросу»
 *  превращается в «по запросу», «депозитная система» — в «депозит».
 *  Сокращаем здесь, а не многоточием в CSS: обрезанное «депозитная сис…»
 *  на карте выглядит поломкой, а не короткой подписью. Площадка вообще
 *  без цены получает то же «по запросу» — пустая метка не читается
 *  как метка. */
function pinLabel(price: string): string {
  if (!price) return 'по запросу';
  if (/депозит/i.test(price)) return 'депозит';
  return price.replace(/^цена\s+/i, '');
}

export function venueMapPoints(): MapPoint[] {
  const feed = FEED.filter((item): item is FeedVenue => item.kind === 'venue');

  return VENUES.filter((venue) => venue.contacts.geo).map((venue) => {
    const card = feed.find((item) => item.slug === venue.slug);
    const geo = venue.contacts.geo!;

    return {
      slug: venue.slug,
      name: venue.name,
      coords: [geo.lat, geo.lon],
      address: venue.contacts.address,
      href: `/${venue.citySlug}/${venue.categorySlug}/${venue.slug}/`,
      price: card?.avgCheck ?? '',
      label: pinLabel(card?.avgCheck ?? ''),
      city: card?.city ?? venue.city,
      capacity: card?.capacity ?? '',
      rating: card?.rating ?? null,
      photo: card?.media[0] ?? venue.hero.image,
    };
  });
}
