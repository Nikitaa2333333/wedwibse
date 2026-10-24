// Каталог для админки — НАСТОЯЩИЕ карточки сайта (площадки + подрядчики)
// одной таблицей. Вместо «процента заполненности» — конкретно, чего не
// хватает: фото из 50, текст, цена, контакты. Вживую то же придёт из базы
// (`venues`, `specialists` с `owner`).
import { VENUES } from '../data/venues';
import { REAL_SPECIALISTS, specialistRole, specialistUrl } from '../data/specialists';

export const PHOTOS_MAX = 50;
/** меньше — карточка смотрится бедно (норма галереи — до 50 кадров) */
export const PHOTOS_LOW = 20;

export interface CatalogRow {
  key: string;
  kind: 'venue' | 'specialist';
  name: string;
  category: string;
  url: string;
  cover?: string;
  photos: number;
  hasText: boolean;
  hasPrice: boolean;
  /** контакты для кнопки «Показать контакты»: у подрядчиков поля пока нет вовсе */
  hasContacts: boolean;
}

export const CATALOG: CatalogRow[] = [
  ...VENUES.map((v) => ({
    key: `venue:${v.slug}`,
    kind: 'venue' as const,
    name: v.name,
    category: 'Площадка',
    url: `/moskva/ploshchadki/${v.slug}/`,
    cover: v.hero?.image,
    photos: v.gallery?.length ?? 0,
    hasText: Boolean(v.lead),
    hasPrice: Boolean(v.terms?.length),
    hasContacts: Boolean(v.contacts?.phone),
  })),
  ...REAL_SPECIALISTS.filter((s) => s.photos.length > 0).map((s) => ({
    key: `specialist:${s.slug}`,
    kind: 'specialist' as const,
    name: s.name,
    category: specialistRole(s),
    url: specialistUrl(s),
    cover: s.photos[0],
    photos: s.photos.length,
    hasText: Boolean(s.story?.length || s.bio),
    hasPrice: Boolean(s.priceFrom),
    hasContacts: false,
  })),
];

/** Карточка по ключу из заглушек (`venue:slug` / `specialist:slug`). */
export function cardByKey(key: string): CatalogRow | undefined {
  return CATALOG.find((c) => c.key === key);
}

/** Что не заполнено — для сводки и вкладок «Карточек». */
export const GAPS = {
  noContacts: CATALOG.filter((c) => !c.hasContacts),
  fewPhotos: CATALOG.filter((c) => c.photos < PHOTOS_LOW),
  noPrice: CATALOG.filter((c) => !c.hasPrice),
};
