// ============================================================
// СНИМОК КАРТОЧКИ ДЛЯ «ИЗБРАННОГО» — одна сборка на все страницы.
// Раздел «Избранное» рисуется из этого снимка и в каталог за данными
// не ходит (см. lib/favorites.ts). Поэтому важно, чтобы карточка каталога
// и карточка самой площадки положили в хранилище ОДНО И ТО ЖЕ: иначе одна
// площадка выглядит в избранном по-разному в зависимости от того, откуда
// её сохранили, а по разным id ещё и двоится.
//
// Цена и рейтинг живут в ленте (feed.ts), а не в карточке площадки
// (venues.ts) — тот же стык, что в lib/map-points.ts. Сводим их здесь,
// чтобы страницы не склеивали два источника каждая по-своему.
// ============================================================
import { FEED, type FeedVenue } from '../data/feed';
import type { FavoriteItem } from './favorites';
import type { Venue } from '../data/venues';
import { favoriteImage } from './images';

export async function venueFavorite(venue: Venue): Promise<FavoriteItem> {
  const card = FEED.find(
    (item): item is FeedVenue => item.kind === 'venue' && item.slug === venue.slug
  );

  return {
    // Ключ — имя из venues.ts, а не из ленты: в ленте демо-карточки ведут
    // на ту же площадку под выдуманными именами, и по ним id разъехался бы
    // с настоящей карточкой каталога.
    id: `venue:${venue.name}`,
    cat: 'venue',
    catLabel: 'Площадки',
    name: venue.name,
    meta: card?.city ?? venue.city,
    price: card?.avgCheck ?? '',
    rating: card?.rating ?? 0,
    img: await favoriteImage(card?.media[0] ?? venue.hero.image),
    href: `/${venue.citySlug}/${venue.categorySlug}/${venue.slug}/`,
  };
}
