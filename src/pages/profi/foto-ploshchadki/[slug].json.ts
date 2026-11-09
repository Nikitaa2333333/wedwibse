// Превью кадров площадки для кабинета «ведём мы» (Никита 09.11: владелец сам убирает фото).
// Кадры площадки — пути из git (/venues/<slug>/p01.webp), отдельного адреса у них нет:
// здесь на сборке путь → готовое превью, кабинет рисует по нему сетку. Статика, как всё на сборке.
//   GET /profi/foto-ploshchadki/<slug>.json → { photos: [{ src, url }] }
import type { APIRoute } from 'astro';
import { getImage } from 'astro:assets';
import { VENUES } from '../../../data/venues';
import { IMG_WIDTHS, resolveImage } from '../../../lib/images';

export function getStaticPaths() {
  return VENUES.map((v) => ({ params: { slug: v.slug } }));
}

export const GET: APIRoute = async ({ params }) => {
  const venue = VENUES.find((v) => v.slug === params.slug);
  const srcs = [...new Set((venue?.gallery ?? []).map((g: any) => (typeof g?.src === 'string' ? g.src : '')))]
    .filter((s) => /\.(webp|jpe?g|png)$/i.test(s));
  const photos: { src: string; url: string }[] = [];
  for (const src of srcs) {
    try {
      const img = await getImage({ src: resolveImage(src), width: IMG_WIDTHS.thumb[1], format: 'webp' });
      photos.push({ src, url: img.src });
    } catch {
      // кадра нет в src/assets — в кабинете его не показываем
    }
  }
  return new Response(JSON.stringify({ photos }), { headers: { 'content-type': 'application/json; charset=utf-8' } });
};
