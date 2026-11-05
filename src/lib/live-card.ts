// САЙТ ИЗ БАЗЫ, ЭТАП 1 (05.11.2026): визитка подрядчика из кабинета собирается
// сервером в момент открытия, прямо из базы — без пересборки сайта.
// Путь данных тот же, что у сборки и превью: запись specialists (page собрал
// хук при одобрении) → cardFromPage (lib/cabinet-card.mjs) → SpecialistProfile.
// Фото — оригиналы из базы по публичному адресу /api/files/…, пережимает
// их /_image (адрес разрешён в astro.config: image.remotePatterns).
// Только опубликованное: фильтр status = "published" стоит здесь, на сервере.
import type { ImageMetadata } from 'astro';
import { inferRemoteSize } from 'astro:assets';
import { cardFromPage, orderedPhotos } from './cabinet-card.mjs';
import { registerRemote, hasRemote } from './images';
import { SPECIALIST_CATEGORIES, type Specialist } from '../data/specialists';

const PB = (process.env.PB_INTERNAL_URL || 'http://127.0.0.1:8090').replace(/\/$/, '');
const FILES = (process.env.PREVIEW_FILES_URL || 'https://wed-secrets.ru').replace(/\/$/, '');
const SLUG = /^[a-z0-9][a-z0-9-]{0,119}$/;

/** опубликованная карточка кабинета → карточка сайта; null — такой нет */
export async function liveSpecialist(category: string, slug: string): Promise<Specialist | null> {
  // slug и категория идут в фильтр базы — только безопасные символы
  if (!SLUG.test(category) || !SLUG.test(slug)) return null;
  const filter = `status = "published" && source = "кабинет" && categorySlug = "${category}" && slug = "${slug}"`;
  const r = await fetch(`${PB}/api/collections/specialists/records?perPage=1&filter=${encodeURIComponent(filter)}`, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`база не ответила: ${r.status}`);
  const rec = (await r.json()).items?.[0];
  if (!rec || rec.page?.source !== 'cabinet') return null;

  const photos: string[] = [];
  for (const name of orderedPhotos(rec.page, rec.photos ?? [])) {
    const key = `${FILES}/api/files/${rec.collectionId}/${rec.id}/${encodeURIComponent(name)}`;
    // размеры кадра узнаём один раз: дальше они в памяти службы
    if (!hasRemote(key)) {
      try {
        const size = await inferRemoteSize(key);
        registerRemote(key, { src: key, width: size.width, height: size.height, format: size.format } as ImageMetadata);
      } catch {
        continue; // битый кадр не роняет страницу — пропускаем, как сборка
      }
    }
    photos.push(key);
  }
  if (!photos.length) return null;

  const card = cardFromPage(rec.page, { slug: rec.slug, categorySlug: rec.categorySlug, name: rec.name, photos });
  return {
    ...card,
    category: SPECIALIST_CATEGORIES.find((c) => c.slug === rec.categorySlug)?.label ?? rec.categorySlug,
  } as Specialist;
}
