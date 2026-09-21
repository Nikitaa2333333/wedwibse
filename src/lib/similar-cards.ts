// ============================================================
// ПОДПИСИ МИНИ-КАРТОЧЕК (RelatedCards) из данных каталога.
// Площадка и подрядчик хранятся по-разному, а ряд «похожих» рисуется
// одним компонентом — сборка строк подписи живёт здесь, чтобы страница
// площадки, визитка и блог не собирали её каждая по-своему.
// ============================================================
import type { FeedVenue } from '../data/feed';
import { FILTERS_BY_CATEGORY, specialistUrl, type Specialist } from '../data/specialists';
import { photosOnly } from './media';

/** контракт мини-карточки — что рисует RelatedCards.astro */
export interface RelatedCard {
  href: string;
  /** кадры рельса: фото и ролики, как в каталоге */
  media: string[];
  alt: string;
  /** первая строка подписи: цена (крупнее) и тип вторым планом */
  price: string;
  type?: string;
  name: string;
  /** третья строка: «Подольск · до 70 гостей», «ЦАО» */
  meta?: string;
}

const priceFmt = new Intl.NumberFormat('ru-RU');

/** карточка ленты → мини-карточка: те же строки, что в каталоге площадок */
export function venueCard(v: FeedVenue): RelatedCard {
  return {
    href: `/moskva/ploshchadki/${v.slug}/`,
    media: v.media,
    alt: v.name,
    price: v.avgCheck,
    type: v.type,
    name: v.name,
    meta: `${v.city} · ${v.capacity}`,
  };
}

/** подпись значения фильтра: cities ['cao'] → «ЦАО» */
function labelOf(cat: string, key: string, value: string | undefined): string {
  if (!value) return '';
  const group = FILTERS_BY_CATEGORY[cat]?.find((g) => g.key === key);
  return group?.options.find((o) => o.value === value)?.label ?? value;
}

/** подрядчик → мини-карточка: цена и стиль — как в сетке категории,
 *  третьей строкой город. Кадры — только фото: ролик в ряду из
 *  трёх мини-карточек в конце страницы играть не должен.
 *
 *  Опыта в подписи нет (заказчик, 19.09.2026): «15 лет» под именем в ряду
 *  рекомендаций читалось не как стаж, а как возраст подрядчика — будто
 *  сервис предлагает подростков. В самой карточке опыт остаётся, там он
 *  стоит рядом со специальностью и читается верно. */
export function specialistCard(s: Specialist): RelatedCard {
  const meta = labelOf(s.categorySlug, 'city', s.cities?.[0]);

  return {
    href: specialistUrl(s),
    media: photosOnly(s.photos).slice(0, 4),
    alt: s.name,
    price: s.priceFrom ? `от ${priceFmt.format(s.priceFrom)} ₽` : 'Цена по запросу',
    type: labelOf(s.categorySlug, 'style', s.styles?.[0]),
    name: s.name,
    meta,
  };
}
