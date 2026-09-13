// Отзывы с Яндекс.Карт из HTML, который отдал Firecrawl (formats/actions
// с html), без участия модели:
//   node scripts/maps-reviews.mjs <firecrawl-result.txt|page.html> <slug>
// Пишет research/<slug>/reviews.json: { rating, ratings, total, items[] }.
// Разметка страницы: itemprop="author"/name, datePublished, ratingValue,
// текст — spoiler-view__text-container. Страница подгружает ~100 отзывов
// на прокрутке; остальные — «показать ещё», это следующий заход.
// Позже те же записи уезжают в коллекцию venue_reviews (PocketBase).
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const [file, slug] = process.argv.slice(2);
if (!file || !slug) { console.error('usage: node scripts/maps-reviews.mjs <html-or-firecrawl-result> <slug>'); process.exit(1); }
let s = await readFile(file, 'utf8');
// результат Firecrawl — JSON, html лежит строкой с экранированием
if (s.includes('\\"business-review-view')) s = s.replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));

const strip = (h) => h.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const human = (iso) => { const d = new Date(iso); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };

const items = [];
const seen = new Set();
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
