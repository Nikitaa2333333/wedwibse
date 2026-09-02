// ============================================================
// РЕЕСТР ИЗОБРАЖЕНИЙ — единая точка входа в оптимизацию Astro.
// Данные (feed.ts, specialists.ts, venues.ts) хранят фото как обычные
// строки-пути ('/venues/river-loft/gal/g4.webp') — так их удобно листать,
// сравнивать, отдавать в JSON фильтров. Здесь строка превращается в
// ImageMetadata, которую понимает <Image> из astro:assets: тот сам
// пережимает файл, режет под нужные ширины и отдаёт srcset.
//
// import.meta.glob подхватывает исходники ТОЛЬКО из src/ — поэтому все
// фотографии карточек должны лежать в src/assets/..., а не в
// public/ (публичная папка отдаётся как есть, без сжатия). Новая категория
// (площадки, подрядчики) — просто кладём файлы в свою подпапку src/assets/,
// глобу для этого ничего менять не нужно.
// ============================================================
import type { ImageMetadata } from 'astro';
import { getImage } from 'astro:assets';

const modules = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/**/*.{webp,jpg,jpeg,png}',
  { eager: true }
);

const registry = new Map<string, ImageMetadata>(
  Object.entries(modules).map(([path, mod]) => [path.replace(/^\/src\/assets/, ''), mod.default])
);

/** path — тот же строковый путь, что лежит в данных, например '/venues/river-loft/gal/g4.webp' */
export function resolveImage(path: string): ImageMetadata {
  const image = registry.get(path);
  if (!image) {
    throw new Error(`resolveImage: нет файла в src/assets для пути "${path}" — проверь, что фото лежит в src/assets, а не только в public`);
  }
  return image;
}

/**
 * Готовый URL пережатого кадра для снимка в localStorage (избранное):
 * туда нельзя класть путь из данных — файл живёт только в src/assets и по
 * такому адресу не отдаётся. Ширина 800 — хватает на обложку папки и карточку.
 */
export async function favoriteImage(path: string): Promise<string> {
  const img = await getImage({ src: resolveImage(path), width: 800, format: 'webp' });
  return img.src;
}
