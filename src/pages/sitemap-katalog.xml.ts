// КАРТА КАТАЛОГА — подрядчики и площадки, собирает сервер из живых данных
// (сайт из базы, этапы 2–3, 05.11.2026). Каталог рисует сервер, готовых файлов в сборке нет,
// поэтому scripts/sitemap.mjs (обходит dist) его не видит. robots.txt
// указывает обе карты: /sitemap.xml (статика) и эту.
import type { APIRoute } from 'astro';
import { SPECIALIST_CATEGORIES, SPECIALISTS_BY_CATEGORY, hasProfile } from '../data/specialists';
import { VENUES } from '../data/venues';
import { refreshLive } from '../lib/live-data';

export const prerender = false;

export const GET: APIRoute = async ({ site }) => {
  await refreshLive();
  const base = (site?.href ?? 'https://wed-secrets.ru/').replace(/\/$/, '');
  // главная тоже рисуется сервером (этап 4) — в статической карте её нет
  const urls = new Set<string>([`${base}/`, `${base}/moskva/podryadchiki/`]);
  // пустая категория («скоро на WED Secrets») стоит с noindex — в карту её не кладём (14.11)
  for (const c of SPECIALIST_CATEGORIES) {
    if ((SPECIALISTS_BY_CATEGORY[c.slug] ?? []).length) urls.add(`${base}/moskva/podryadchiki/${c.slug}/`);
  }
  for (const list of Object.values(SPECIALISTS_BY_CATEGORY)) {
    for (const s of list) {
      // одна карточка — один адрес, по родной категории
      if (!s.demo && hasProfile(s)) urls.add(`${base}/moskva/podryadchiki/${s.categorySlug}/${s.slug}/`);
    }
  }
  urls.add(`${base}/moskva/ploshchadki/`);
  for (const v of VENUES) urls.add(`${base}/moskva/ploshchadki/${v.slug}/`);
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + [...urls].sort().map((u) => `  <url><loc>${u}</loc></url>`).join('\n') + '\n</urlset>\n';
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=0, s-maxage=60' } });
};
