// ============================================================
// ТЕЛО КАРТОЧКИ ПЛОЩАДКИ КАК СПИСОК БЛОКОВ.
// Страница /moskva/ploshchadki/[slug] рисует то, что вернула venueBlocks():
// у площадки с полем `blocks` — её собственный порядок, у площадки
// без него — прежняя последовательность из полей (ничего не меняется
// для River Loft, Лесной Росы, Spark Hall и LЁD).
// ============================================================
import type { Venue, VenueBlock } from '../data/venues';

export function venueBlocks(venue: Venue): VenueBlock[] {
  if (venue.blocks?.length) return venue.blocks;

  const blocks: VenueBlock[] = [
    { type: 'stats', items: venue.stats },
    { type: 'scenes', kicker: 'Сцены', title: 'Как устроена площадка', scenes: venue.scenes },
    {
      type: 'terms',
      title: venue.termsTitle,
      terms: venue.terms,
      included: venue.included,
      extras: venue.extras,
    },
    { type: 'rules', rules: venue.rules },
  ];
  if (venue.docs?.length) blocks.push({ type: 'docs', docs: venue.docs });
  blocks.push({ type: 'gallery' }, { type: 'reviews' }, { type: 'faq', items: venue.faq });
  return blocks;
}
