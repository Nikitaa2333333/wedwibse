// ============================================================
// ФАКТЫ ДЛЯ ТАБЛИЦЫ СРАВНЕНИЯ — по id карточки избранного.
// Снимок в избранном (lib/favorites.ts) нарочно короткий: имя, одна
// строка, цена, рейтинг. Для сравнения этого мало — нужны вместимость,
// район, опыт. Реестр собирается НА СБОРКЕ из тех же данных, что и
// каталоги (feed.ts, specialists.ts), и уезжает на страницу «Избранного»
// одним JSON: клиент ничего не запрашивает, а данные не двоятся во
// втором снимке. Когда появится бэкенд, это станет одним запросом по
// списку id — контракт «id → факты» остаётся тем же.
//
// id совпадают с теми, что кладут кнопки «в избранное»:
//   площадка   — `venue:${name}`        (ploshchadki/index.astro, favorite-snapshot.ts)
//   специалист — `${categorySlug}:${slug}` (podryadchiki/*)
// ============================================================
import { FEED } from '../data/feed';
import { SPECIALISTS_BY_CATEGORY, FILTERS_BY_CATEGORY, type Specialist } from '../data/specialists';
import { favoriteImage } from './images';
import { withCount } from './plural';

export interface Fact {
  label: string;
  value: string;
}

const priceFmt = new Intl.NumberFormat('ru-RU');

const years = (n: number) => withCount(n, ['год', 'года', 'лет']);
const reviews = (n: number) => withCount(n, ['отзыв', 'отзыва', 'отзывов']);

/** подписи значений фильтра: cities: ['цао'] → «ЦАО» */
function labelsOf(cat: string, key: string, values: string[] | undefined): string {
  if (!values?.length) return '';
  const group = FILTERS_BY_CATEGORY[cat]?.find((g) => g.key === key);
  return values
    .map((v) => group?.options.find((o) => o.value === v)?.label ?? v)
    .join(', ');
}

function specialistFacts(cat: string, s: Specialist): Fact[] {
  const facts: Fact[] = [];
  facts.push({
    label: 'Цена',
    value: s.priceFrom ? `от ${priceFmt.format(s.priceFrom)} ₽${s.priceNote ? ` · ${s.priceNote}` : ''}` : 'по запросу',
  });
  if (s.experienceYears) facts.push({ label: 'Опыт', value: years(s.experienceYears) });
  const city = labelsOf(cat, 'city', s.cities);
  if (city) facts.push({ label: 'Город и выезд', value: city });
  const style = labelsOf(cat, 'style', s.styles);
  if (style) facts.push({ label: 'Стиль', value: style });
  if (s.rating) facts.push({ label: 'Рейтинг', value: `★ ${s.rating.toFixed(1)}${s.reviews ? ` · ${reviews(s.reviews)}` : ''}` });
  return facts;
}

/** весь реестр: id карточки → строки таблицы (порядок строк — порядок фактов) */
export function compareFacts(): Record<string, Fact[]> {
  const out: Record<string, Fact[]> = {};

  for (const item of FEED) {
    if (item.kind !== 'venue') continue;
    out[`venue:${item.name}`] = [
      { label: 'Средний чек', value: item.avgCheck },
      { label: 'Вместимость', value: item.capacity },
      { label: 'Место', value: item.city },
      { label: 'Тип', value: item.type },
      { label: 'Рейтинг', value: `★ ${item.rating.toFixed(1)} · ${reviews(item.reviews)}` },
    ];
  }

  for (const [cat, list] of Object.entries(SPECIALISTS_BY_CATEGORY)) {
    for (const s of list) out[`${cat}:${s.slug}`] = specialistFacts(cat, s);
  }

  return out;
}

/**
 * Обложки для сцены отбора: id карточки → свежий URL кадра со сборки.
 *
 * Снимок в localStorage (lib/favorites.ts) хранит URL, посчитанный в тот
 * момент, когда человек нажал сердце. Имя файла в сборке содержит хеш,
 * и после КАЖДОГО деплоя старый адрес умирает — снимок месячной давности
 * показывает битую картинку. Для списка избранного это терпимо (карточка
 * там мелкая), но сцена отбора — кадр во весь экран, и дыра в нём видна
 * сразу же.
 *
 * Поэтому кадры для отбора считаются на сборке рядом с фактами и уезжают
 * тем же JSON: адрес всегда принадлежит текущей сборке. Снимок остаётся
 * запасным вариантом — для карточки, которой в данных уже нет.
 */
export async function compareCovers(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};

  for (const item of FEED) {
    if (item.kind !== 'venue' || !item.media[0]) continue;
    out[`venue:${item.name}`] = await favoriteImage(item.media[0]);
  }

  for (const [cat, list] of Object.entries(SPECIALISTS_BY_CATEGORY)) {
    for (const s of list) {
      const first = s.photos?.[0];
      if (first) out[`${cat}:${s.slug}`] = await favoriteImage(first);
    }
  }

  return out;
}
