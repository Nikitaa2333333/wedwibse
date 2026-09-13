// Отзывы с Яндекс.Карт из HTML, который отдал Firecrawl (formats/actions
// с html), без участия модели:
//   node scripts/maps-reviews.mjs <firecrawl-result.txt|page.html> <slug>
// Пишет research/<slug>/reviews.json: { rating, ratings, total, items[] }.
// Полный текст — из JSON-состояния страницы (в разметке длинные отзывы
// свёрнуты до ~200 знаков). Страница держит ~100 отзывов, хватает: храним 20.
// Позже те же записи уезжают в коллекцию venue_reviews (PocketBase).
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const [file, slug] = process.argv.slice(2);
if (!file || !slug) { console.error('usage: node scripts/maps-reviews.mjs <html-or-firecrawl-result> <slug>'); process.exit(1); }
const rawFile = await readFile(file, 'utf8');
// Результат Firecrawl — JSON с полем html (плюс поле scrapes у actions);
// разбираем его как JSON и берём html строкой — так экранирование снимает
// сам парсер, без ручных replace. Голый .html подаётся как есть.
let s = rawFile;
try {
  const parsed = JSON.parse(rawFile.replace(/^[^{]*/, ''));
  // верхний html бывает скелетом до прокрутки, полный — в scrapes после
  // actions: берём самый длинный из всех
  const candidates = [parsed.html, ...(parsed.actions?.scrapes?.map((x) => x.html) ?? [])].filter(Boolean);
  s = candidates.sort((a, b) => b.length - a.length)[0] ?? rawFile;
} catch {
  // не JSON — значит уже html
}
// JSON-состояние страницы внутри html экранировано ещё раз (\" внутри
// <script>): снимаем один слой для поиска записей отзывов
const stateSrc = s.replace(/\\\\/g, '\\').replace(/\\"/g, '"');

const strip = (h) => h.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const human = (iso) => { const d = new Date(iso); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };

const items = [];
const seen = new Set();

// ============ ПОЛНЫЙ ТЕКСТ — ИЗ JSON-СОСТОЯНИЯ СТРАНИЦЫ ============
// В разметке длинный отзыв свёрнут: первые ~200 знаков и кнопка «Ещё»,
// остальное Карты подгружают по клику. Но страница несёт своё состояние
// в JSON, и там у каждого отзыва поле text целиком:
//   {"reviewId":…,"author":{"name":…},"text":"…","rating":4,"updatedTime":"…"}
// Берём оттуда; разметка ниже остаётся запасным путём.
const unesc = (t) => JSON.parse('"' + t + '"');
const STATE_RE = /"reviewId":"[^"]+","businessId":"\d+","author":\{"name":"((?:[^"\\]|\\.)*)"[\s\S]*?"text":"((?:[^"\\]|\\.)*)"[\s\S]*?"rating":(\d),"updatedTime":"([^"]+)"/g;
for (const m of stateSrc.matchAll(STATE_RE)) {
  let author, text;
  try { author = unesc(m[1]); text = unesc(m[2]); } catch { continue; }
  const rating = Number(m[3]);
  const iso = m[4];
  text = text.replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim();
  if (!author || !text || !rating) continue;
  const key = `${author}|${iso}`;
  if (seen.has(key)) continue;
  seen.add(key);
  items.push({ author, date: human(iso), iso, rating, text });
}

// ============ ЗАПАСНОЙ ПУТЬ — РАЗМЕТКА (текст может быть обрезан) ============
if (!items.length) {
  for (const m of s.matchAll(/<div class="business-review-view"[\s\S]*?(?=<div class="business-reviews-card-view__review"|<div class="business-reviews-card-view__space|$)/g)) {
    const b = m[0];
    const author = strip(b.match(/itemprop="author"[\s\S]*?<span itemprop="name"[^>]*>([\s\S]*?)<\/span>/)?.[1] ?? '');
    const iso = b.match(/itemprop="datePublished" content="([^"]+)"/)?.[1];
    const rating = Number(b.match(/itemprop="ratingValue" content="([\d.]+)"/)?.[1] ?? 0);
    const text = strip(b.match(/spoiler-view__text-container[^>]*>([\s\S]*?)<\/span>/)?.[1] ?? '');
    if (!author || !text || !rating) continue;
    const key = `${author}|${iso}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ author, date: iso ? human(iso) : '', iso: iso ?? null, rating: Math.round(rating), text });
  }
  console.error('внимание: отзывы взяты из разметки, длинные тексты обрезаны');
}

items.sort((a, b) => (b.iso ?? '').localeCompare(a.iso ?? ''));
// Храним только свежие: витрине хватает 20, остальное — хлам в репозитории.
const LATEST = 20;
const kept = items.slice(0, LATEST);

// Агрегат — из og:description: «Рейтинг 4,5 на основе 22 оценок и 16 отзывов»
const desc = s.match(/"description":\s*"(Рейтинг[^"]*)"/)?.[1] ?? s.match(/content="(Рейтинг[^"]*)"/)?.[1] ?? '';
const rating = Number((desc.match(/Рейтинг\s+([\d,.]+)/)?.[1] ?? '0').replace(',', '.'));
const ratings = Number(desc.match(/(\d+)\s+оцен/)?.[1] ?? 0);
const total = Number(desc.match(/(\d+)\s+отзыв/)?.[1] ?? items.length);

const out = { source: 'yandex-maps', pulled: new Date().toISOString().slice(0, 10), rating, ratings, total, items: kept };
await writeFile(join('research', slug, 'reviews.json'), JSON.stringify(out, null, 2));
console.log(`${slug}: сохранено ${kept.length} из ${items.length} отзывов (всего на карте ${total}, оценок ${ratings}, рейтинг ${rating})`);
