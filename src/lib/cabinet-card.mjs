// Карточка из кабинета → карточка сайта (вид JSON конвейера, тип Specialist).
// Тело страницы `page` собирает база (pb_hooks/lib/cabinet.js, buildPage) —
// при одобрении и для превью анкеты. Здесь — второй, общий шаг: его делают
// и сборка сайта (scripts/pb-pull-cabinet.mjs), и превью (/profi/prevyu/).
// Один модуль на двоих: превью не врёт, пока это не копия.
// Чистый .mjs без зависимостей — скрипт сборки запускается голым node.

const rub = (n) => `${Number(n).toLocaleString('ru-RU').replace(/ /g, ' ')} ₽`;

/** текст визитки: разделы анкеты (уже StorySection) + тарифы отдельным
 *  разделом; у старых правок без разделов — «О себе» абзацами */
export function storyOf(p) {
  const story = Array.isArray(p.story) && p.story.length
    ? [...p.story]
    : [{ text: String(p.about ?? '').split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean) }];
  const tariffs = (p.tariffs ?? []).filter((t) => t.name && t.price);
  if (tariffs.length) {
    story.push({
      title: 'Тарифы',
      tariffs: tariffs.map((t) => ({ name: t.name, price: rub(t.price), ...(t.unit ? { unit: t.unit } : {}), ...(t.includes?.length ? { includes: t.includes } : {}) })),
    });
  }
  return story;
}

/** имена файлов страницы в порядке показа: обложка — первым кадром */
export function orderedPhotos(p, fallback = []) {
  const names = [...(p.photos ?? fallback)];
  const cover = names.splice(p.cover ?? 0, 1);
  return [...cover, ...names];
}

/**
 * page + уже готовые пути кадров → карточка сайта.
 * `category` (подпись раздела) ставит data/specialists.ts по categorySlug.
 */
export function cardFromPage(p, { slug, categorySlug, name, photos }) {
  return {
    slug,
    categorySlug,
    category: '',
    name: p.name || name,
    photos,
    tagline: p.tagline ?? '',
    bio: p.about ?? '',
    ...(p.priceFrom ? { priceFrom: p.priceFrom } : {}),
    ...(p.priceNote ? { priceNote: p.priceNote } : {}),
    ...(p.filters && Object.keys(p.filters).length ? { filters: p.filters } : {}),
    ...(p.filters?.gender ? { gender: p.filters.gender } : {}),
    story: storyOf(p),
  };
}
