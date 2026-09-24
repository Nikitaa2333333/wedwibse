// Проверка карточки подрядчика перед сборкой (без токенов):
//   node scripts/verify-specialist.mjs <category> <slug>
// 1. Обязательные поля, categorySlug из списка категорий, slug = имя файла.
// 2. Значения filters существуют в FILTERS_BY_CATEGORY этой категории
//    (значения фильтров — закрытые списки, см. data/specialists.ts).
// 3. Каждое фото из JSON есть в research/specialists/<slug>/photos
//    или в src/assets/specialists/<category>/<slug>/; avatar — в avatars/.
// 4. Каждое число в текстах встречается в сырье research/specialists/<slug>/.
// 5. Типографика: жирность, капс, двойные пробелы, штампы.
import { readFile, readdir, access } from 'node:fs/promises';
import { join } from 'node:path';

const [category, slug] = process.argv.slice(2);
if (!category || !slug) { console.error('usage: node scripts/verify-specialist.mjs <category> <slug>'); process.exit(1); }
const base = join('research', 'specialists', slug);
const s = JSON.parse(await readFile(join('src', 'data', 'specialists', category, `${slug}.json`), 'utf8'));
const errors = [];

// --- 1. структура
for (const k of ['slug', 'categorySlug', 'category', 'name', 'photos', 'tagline', 'bio', 'filters']) {
  if (!(k in s)) errors.push(`нет поля ${k}`);
}
if (s.slug !== slug) errors.push(`slug в файле (${s.slug}) не совпадает с именем файла`);
if (s.categorySlug !== category) errors.push(`categorySlug (${s.categorySlug}) не совпадает с папкой ${category}`);
if (!s.quote && !s.offers) errors.push('нет ни quote, ни offers — визитка без них не собирается');
// Пустой photos — осознанная карточка «портфолио ещё нет» (первый экран
// рисует инициалы, 24.09.2026). Ошибка — только 1–7 кадров: такое бывает
// от недокачанного диска, а не по решению.
const nPhotos = s.photos?.length ?? 0;
if (nPhotos > 0 && nPhotos < 8) errors.push(`photos: ${nPhotos}, нужно не меньше 8 (или пусто, если портфолио нет)`);
if (nPhotos === 0) console.log(`  · ${category}/${slug}: без фото — первый экран с инициалами`);
if (s.priceFrom == null && !s.priceNote) errors.push('нет priceFrom и нет priceNote — карточка без подписи цены');
if (s.rating != null || s.reviews != null) errors.push('rating/reviews у реального подрядчика не ставим, пока нет собранных отзывов');
if (s.tagline?.length > 48) errors.push(`tagline длиннее 48 знаков: «${s.tagline}»`);

// --- 2. значения фильтров против списка категории
const src = await readFile('src/data/specialists.ts', 'utf8');
const catList = src.match(/SPECIALIST_CATEGORIES[\s\S]*?\];/)?.[0] ?? '';
if (!catList.includes(`slug: '${category}'`)) errors.push(`категории ${category} нет в SPECIALIST_CATEGORIES`);
// Наборы живут в specialist-filters.ts и собраны хелперами (multi/single),
// текстом их не разобрать — импортируем как есть (Node 25 читает .ts сам).
const { FILTERS_BY_CATEGORY } = await import('../src/data/specialist-filters.ts');
const groupsOfCat = FILTERS_BY_CATEGORY[category];
if (groupsOfCat) {
  const allowed = Object.fromEntries(groupsOfCat.map((g) => [g.key, g.options.map((o) => o.value)]));
  for (const [key, val] of Object.entries(s.filters ?? {})) {
    if (!allowed[key]) { errors.push(`filters.${key}: такого фильтра нет у категории ${category}`); continue; }
    for (const v of Array.isArray(val) ? val : [val]) if (!allowed[key].includes(v)) errors.push(`filters.${key}: значение «${v}» не из списка (${allowed[key].join(', ')})`);
  }
} else {
  errors.push(`у категории ${category} нет фильтров в FILTERS_BY_CATEGORY — каталог соберётся без полосы чипов; завести фильтры отдельно`);
}

// --- 3. фото
const text = JSON.stringify(s);
const refs = new Set(text.match(/\/specialists\/[\w./-]+\.(webp|jpg|png)/g) ?? []);
for (const ref of refs) {
  const rel = ref.replace(/^\/specialists\//, '');
  const file = rel.split('/').pop();
  let ok = false;
  for (const p of [join('src', 'assets', 'specialists', rel), join(base, 'photos', file), join(base, 'avatar.webp')]) {
    try { await access(p); ok = true; break; } catch {}
  }
  if (!ok) errors.push(`нет файла для ${ref}`);
}

// --- 4. цифры против сырья
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
const norm = (t) => t.replace(/[\s ]/g, '');
const corpusN = norm(corpus) + '\n' + corpus.replace(/[^\d\n]/g, '');
const strings = [];
// Значения фильтров и бакеты («35–50», «15+») — ключи закрытых списков,
// а не текст подрядчика: их в сырье не ищем. Проверяются пунктом 2.
const ENUM_KEYS = new Set(['filters', 'age', 'cities', 'styles', 'formats', 'languages']);
(function walk(v, key) {
  if (ENUM_KEYS.has(key)) return;
  if (typeof v === 'string') strings.push(v);
  else if (Array.isArray(v)) v.forEach((x) => walk(x));
  else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => walk(x, k));
})(s);
const seen = new Set();
for (const t of strings) {
  if (/^\/specialists\//.test(t) || /^https?:/.test(t) || /^tel:/.test(t)) continue;
  for (const m of t.matchAll(/\d[\d\s ]*\d|\d/g)) {
    const n = norm(m[0]);
    if (n.length < 2 || /^(19|20)\d\d$/.test(n) || seen.has(n)) continue;
    seen.add(n);
    const digits = n.replace(/\D/g, '');
    if (!corpusN.includes(n) && !(digits.length >= 10 && corpusN.includes(digits))) errors.push(`число «${m[0].trim()}» не найдено в сырье: «${t.slice(0, 80)}…»`);
  }
}

// --- 5. типографика и штампы
const CLICHE = /уникальн|незабываем|волшебн|идеальн(ый|ое) (день|место)|мечты|эмоци[ий] на всю жизнь/i;
for (const t of strings) {
  if (/<\/?(b|strong)>/.test(t)) errors.push(`жирность в тексте: «${t.slice(0, 60)}»`);
  if (/\b[А-ЯЁA-Z]{4,}\b/.test(t) && !/\b(LED|HDMI|DMX|VIP|FHD|4K|DJ|RAW|JPEG|МКАД)\b/.test(t)) errors.push(`капс: «${t.slice(0, 60)}»`);
  if (/ {2,}/.test(t)) errors.push(`двойной пробел: «${t.slice(0, 60)}»`);
  if (CLICHE.test(t)) errors.push(`штамп: «${t.slice(0, 70)}»`);
}

if (errors.length) {
  console.error(`✗ ${category}/${slug}: ${errors.length} проблем`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log(`✓ ${category}/${slug}: структура, фильтры, ${refs.size} фото, ${seen.size} чисел, типографика — ок`);
