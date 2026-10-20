import type { APIRoute } from 'astro';

// robots.txt собирается, а не лежит статикой в public/, — чтобы содержимое
// зависело от того же флага, что и мета-тег robots в Layout.astro.
// Индексация открыта 20.10.2026 (SITE_INDEXABLE=true в deploy.yml, SEO.md, раздел 5).
const indexable = process.env.SITE_INDEXABLE === 'true';

const site = (process.env.SITE_URL || 'https://wed-secrets.ru').replace(/\/$/, '');

// Карта сайта собирается после сборки скриптом scripts/sitemap.mjs (deploy.yml).
const body = indexable
  ? `User-agent: *\nAllow: /\n\nSitemap: ${site}/sitemap.xml\n`
  : 'User-agent: *\nDisallow: /\n';

export const GET: APIRoute = () =>
  new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
