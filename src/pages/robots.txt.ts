import type { APIRoute } from 'astro';

// robots.txt собирается, а не лежит статикой в public/, — чтобы содержимое
// зависело от того же флага, что и мета-тег robots в Layout.astro.
// Дизайн-фаза: закрыто от поисковиков. Открыть — SITE_INDEXABLE=true при сборке.
const indexable = process.env.SITE_INDEXABLE === 'true';

const body = indexable
  ? 'User-agent: *\nAllow: /\n'
  : 'User-agent: *\nDisallow: /\n';

export const GET: APIRoute = () =>
  new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
