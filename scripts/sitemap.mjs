// Карта сайта из готовой сборки: обходит dist/ после `astro build` и пишет
// dist/sitemap.xml. Собираем из HTML, а не из данных: так в карту попадает
// ровно то, что реально лежит на сервере, и новая страница не потеряется.
// Страницы с <meta name="robots" content="noindex"> (избранное и т.п.)
// в карту не идут. Зависимостей нет — решение 20.10.2026 (docs/seo/SEO.md, раздел 5).
//
//   node scripts/sitemap.mjs [dist] [https://wed-secrets.ru]
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const dist = process.argv[2] || 'dist';
const site = (process.argv[3] || process.env.SITE_URL || 'https://wed-secrets.ru').replace(/\/$/, '');

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : name === 'index.html' ? [p] : [];
  });
}

const NOINDEX = /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i;
const urls = [];
for (const file of walk(dist)) {
  const html = readFileSync(file, 'utf8');
  if (NOINDEX.test(html)) continue;
  const rel = relative(dist, file).split(sep).slice(0, -1).join('/');
  urls.push(`${site}/${rel ? rel + '/' : ''}`);
}
// Визитки карточек из кабинета готовыми файлами не собираются — их рисует
// сервер из базы (сайт из базы, этап 1, 05.11.2026). В карту — из тех же
// данных, что сборка выгрузила из базы перед build (pb-pull-cabinet).
const CAB = 'src/data/cabinet/specialists';
if (existsSync(CAB)) {
  for (const f of readdirSync(CAB).filter((n) => n.endsWith('.json'))) {
    const c = JSON.parse(readFileSync(join(CAB, f), 'utf8'));
    if (!c.slug || !c.categorySlug || !(c.quote || c.offers || c.story?.length)) continue;
    const u = `${site}/moskva/podryadchiki/${c.categorySlug}/${c.slug}/`;
    if (!urls.includes(u)) urls.push(u);
  }
}
urls.sort();

const xml =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map((u) => `  <url><loc>${u}</loc></url>`).join('\n') +
  '\n</urlset>\n';
writeFileSync(join(dist, 'sitemap.xml'), xml);
console.log(`sitemap.xml: ${urls.length} страниц`);
