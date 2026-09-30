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
import { VENUES } from '../data/venues';
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
/** значения из данных, которых нет среди вариантов фильтра (город
    карточки записан шире, чем округа в фильтре) — человеческая подпись */
const RAW_LABELS: Record<string, string> = { moskva: 'Вся Москва', mo: 'Московская область' };

/** округа Москвы — значения группы «Город и выезд» (specialist-filters.ts, CITY) */
const MSK_OKRUGS = ['цао', 'сао', 'свао', 'вао', 'юво', 'юао', 'юзао', 'зао', 'сзао'];

function labelsOf(cat: string, key: string, values: string[] | undefined): string {
  if (!values?.length) return '';
  const group = FILTERS_BY_CATEGORY[cat]?.find((g) => g.key === key);
  return values
    .map((v) => group?.options.find((o) => o.value === v)?.label ?? RAW_LABELS[v] ?? v)
    .join(', ');
}

// КРИТЕРИИ СРАВНЕНИЯ = ФИЛЬТРЫ КАТЕГОРИИ (заказчик, 30.09.2026): в таблицу
// идут те же параметры, по которым категорию фильтруют в каталоге
// (specialist-filters.ts), в том же порядке. Второго списка «что
// сравнивать» не заводим: появился фильтр — появилась строка сравнения.
//
// Значения берём из s.filters (карта «группа → значение»), а у ранних
// карточек, где часть полей живёт отдельными свойствами, — из них.
// Бакеты цены и опыта не показываем: вместо «от 50 до 100 тыс.» в таблице
// точная цена и точный стаж.
const SKIP_GROUPS = new Set(['price', 'priceHour', 'priceTier', 'pricePerson', 'priceKg', 'experience']);

const yesNo = (v: boolean | undefined) => (v === undefined ? undefined : v ? 'yes' : 'no');

/** значение фильтра у карточки: s.filters, иначе старое отдельное поле */
function rawValue(s: Specialist, key: string): string | string[] | undefined {
  const fromMap = s.filters?.[key];
  if (fromMap !== undefined && fromMap !== '' && !(Array.isArray(fromMap) && !fromMap.length)) return fromMap;
  const legacy: Record<string, string | string[] | undefined> = {
    gender: s.gender,
    age: s.age,
    city: s.cities,
    style: s.styles,
    formats: s.formats,
    languages: s.languages,
    ownDJ: yesNo(s.hasOwnDJ),
    ceremonyMaster: yesNo(s.ceremonyMaster),
    equipment: yesNo(s.hasEquipment),
  };
  return legacy[key];
}

function specialistFacts(cat: string, s: Specialist): Fact[] {
  const facts: Fact[] = [];
  facts.push({
    label: 'Цена',
    value: s.priceFrom ? `от ${priceFmt.format(s.priceFrom)} ₽${s.priceNote ? ` · ${s.priceNote}` : ''}` : 'по запросу',
  });
  if (s.experienceYears) facts.push({ label: 'Опыт', value: years(s.experienceYears) });

  for (const group of FILTERS_BY_CATEGORY[cat] ?? []) {
    if (SKIP_GROUPS.has(group.key)) continue;
    const raw = rawValue(s, group.key);
    if (raw === undefined) continue;
    let list = Array.isArray(raw) ? raw : [raw];
    // все девять округов подряд в ячейке таблицы — стена текста: «Вся Москва»
    if (group.key === 'city' && MSK_OKRUGS.every((o) => list.includes(o))) {
      list = ['moskva', ...list.filter((v) => !MSK_OKRUGS.includes(v))];
    }
    const value = labelsOf(cat, group.key, list);
    if (value) facts.push({ label: group.label, value });
  }

  if (s.rating) facts.push({ label: 'Рейтинг', value: `★ ${s.rating.toFixed(1)}${s.reviews ? ` · ${reviews(s.reviews)}` : ''}` });
  return facts;
}

// Площадки: четыре фильтра каталога (тип, место, вместимость, чек) плюс
// то, что у площадки со своей страницей лежит в строке фактов первого
// экрана (площадь, форматы, кухня) и число залов. Повторы подписей
// («Вместимость» есть и там, и там) не дублируем.
const venueByName = new Map(VENUES.map((v) => [v.name, v]));
const halls = (n: number) => withCount(n, ['зал', 'зала', 'залов']);

function venueExtras(name: string, have: Set<string>): Fact[] {
  const v = venueByName.get(name);
  if (!v) return [];
  const out: Fact[] = [];
  for (const row of v.meta ?? []) {
    if (!row.value || have.has(row.label)) continue;
    out.push({ label: row.label, value: row.value });
  }
  if (v.halls?.length) out.push({ label: 'Залы', value: halls(v.halls.length) });
  return out;
}

/** весь реестр: id карточки → строки таблицы (порядок строк — порядок фактов) */
export function compareFacts(): Record<string, Fact[]> {
  const out: Record<string, Fact[]> = {};

  for (const item of FEED) {
    if (item.kind !== 'venue') continue;
    const base: Fact[] = [
      { label: 'Средний чек', value: item.avgCheck },
      { label: 'Вместимость', value: item.capacity },
      { label: 'Место', value: item.city },
      { label: 'Тип', value: item.type },
    ];
    const have = new Set(base.map((f) => f.label));
    out[`venue:${item.name}`] = [
      ...base,
      ...venueExtras(item.name, have),
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
