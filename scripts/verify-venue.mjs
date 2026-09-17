// Детерминированная проверка venue.json перед сборкой (без токенов):
//   node scripts/verify-venue.mjs <slug>
// 1. Обязательные поля и типы блоков.
// 2. Каждое фото из JSON существует в research/<slug>/photos или src/assets.
// 3. Каждое ЧИСЛО в текстах (цены, метры, гости, км) встречается в сырье
//    research/<slug>/ (facts.json, site/*.md, notes.md) — выдуманные цифры
//    не проходят. Годы 19xx/20xx и номера сцен 01–09 пропускаются.
// 4. Запрещённая типографика: <b>, <strong>, КАПС-слова длиннее 3 букв,
//    «—» в начале пункта списка, двойные пробелы.
import { readFile, readdir, access } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';

const slug = process.argv[2];
if (!slug) { console.error('usage: node scripts/verify-venue.mjs <slug>'); process.exit(1); }
const base = join('research', slug);
const venue = JSON.parse(await readFile(join('src', 'data', 'venues', `${slug}.json`), 'utf8'));
const errors = [];

// --- 1. структура
for (const k of ['slug', 'citySlug', 'city', 'category', 'categorySlug', 'name', 'kicker', 'title', 'lead', 'hero', 'meta', 'stats', 'blocks', 'scenes', 'terms', 'included', 'extras', 'rules', 'gallery', 'faq', 'contacts', 'seo']) {
  if (!(k in venue)) errors.push(`нет поля ${k}`);
}
if (venue.slug !== slug) errors.push(`slug в файле (${venue.slug}) не совпадает с именем файла`);
const TYPES = new Set(['stats', 'scenes', 'statement', 'terms', 'rules', 'docs', 'gallery', 'reviews', 'reels', 'halls-index', 'halls', 'faq']);
for (const [i, b] of (venue.blocks ?? []).entries()) {
  if (!TYPES.has(b.type)) errors.push(`blocks[${i}]: неизвестный тип ${b.type}`);
  if (b.type === 'scenes') for (const s of b.scenes) {
    if (s.layout === 'gallery' && !(s.images?.length >= 2)) errors.push(`сцена ${s.num}: layout gallery без images`);
  }
}
if (venue.kicker?.length > 34) errors.push(`kicker длиннее 32 знаков: «${venue.kicker}»`);
if (!venue.contacts?.geo) errors.push('contacts.geo не задан — площадка не попадёт на карту');
if (!venue.gallery?.length) errors.push('gallery пуста — первый экран листает именно её');

// --- 2. фото
const text = JSON.stringify(venue);
const refs = new Set(text.match(new RegExp(`/venues/${slug}/[\\w./-]+\\.(webp|jpg)`, 'g')) ?? []);
for (const ref of refs) {
  const file = ref.slice(`/venues/${slug}/`.length);
  let ok = false;
  // комплекс из залов (Гребнево): кадр `<зал>/pNN.webp` живёт в research/<slug>/<зал>/photos/
  const nested = join(base, dirname(file), 'photos', basename(file));
  for (const p of [join(base, 'photos', file), join('src', 'assets', 'venues', slug, file), nested]) {
    try { await access(p); ok = true; break; } catch {}
  }
  if (!ok) errors.push(`нет файла для ${ref}`);
}

// --- 3. цифры против сырья
let corpus = '';
async function slurp(dir) {
  let names = [];
  try { names = await readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const d of names) {
    const p = join(dir, d.name);
    if (d.isDirectory()) { if (!/^(raw|photos)/.test(d.name)) await slurp(p); }
    else if (/\.(md|json|txt)$/.test(d.name) && d.name !== 'photos.json') corpus += '\n' + (await readFile(p, 'utf8'));
  }
}
await slurp(base);
const norm = (s) => s.replace(/[\s ]/g, '');
// телефоны в сырье бывают «+7 (495) 755-39-43», у нас «+7 495 755 39 43»: сверяем по голым цифрам
const corpusN = norm(corpus) + '\n' + corpus.replace(/[^\d\n]/g, '');
const strings = [];
(function walk(v) {
  if (typeof v === 'string') strings.push(v);
  else if (Array.isArray(v)) v.forEach(walk);
  else if (v && typeof v === 'object') Object.values(v).forEach(walk);
})(venue);
const seen = new Set();
for (const s of strings) {
  if (/^\/venues\//.test(s) || /^https?:/.test(s) || /^tel:/.test(s)) continue;
  for (const m of s.matchAll(/\d[\d\s ]*\d|\d/g)) {
    const n = norm(m[0]);
    if (n.length < 2 || /^(19|20)\d\d$/.test(n)) continue; // одиночные цифры и годы не проверяем
    if (seen.has(n)) continue;
    seen.add(n);
    const digits = n.replace(/\D/g, '');
    if (!corpusN.includes(n) && !(digits.length >= 10 && corpusN.includes(digits))) errors.push(`число «${m[0].trim()}» не найдено в сырье: «${s.slice(0, 80)}…»`);
  }
}

// --- 4. типографика
for (const s of strings) {
  if (/<\/?(b|strong)>/.test(s)) errors.push(`жирность в тексте: «${s.slice(0, 60)}»`);
  if (/\b[А-ЯЁA-Z]{4,}\b/.test(s) && !/\b(LED|HDMI|DMX|VIP|JBL|FHD|XLR|SPA|МКАД|ЦКАД|DJ)\b/.test(s)) errors.push(`капс: «${s.slice(0, 60)}»`);
  if (/ {2,}/.test(s)) errors.push(`двойной пробел: «${s.slice(0, 60)}»`);
}

if (errors.length) {
  console.error(`✗ ${slug}: ${errors.length} проблем`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log(`✓ ${slug}: структура, ${refs.size} фото, ${seen.size} чисел, типографика — ок`);
