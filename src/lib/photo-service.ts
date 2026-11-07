// ============================================================
// Служба картинок Astro для боевой сборки (сервис фото, 07.11.2026).
//
// Внешняя служба (только getURL, без transform): Astro с ней НЕ режет фото
// ни при сборке, ни на сервере — <Image>/<Picture> лишь пишут в srcset адреса
// /ph/…, а режет imgproxy (см. src/lib/photo-url.mjs, docs/PHOTO-SERVICE.md).
// Включается переменной PHOTO_SERVICE=1 (deploy.yml); в `astro dev` и
// в локальной сборке без неё работает обычный sharp — imgproxy на ноутбуке нет.
// ============================================================
import type { ExternalImageService } from 'astro';
import { baseService } from 'astro/assets';
import { photoUrl } from './photo-url.mjs';

const service: ExternalImageService = {
  validateOptions: baseService.validateOptions,
  getHTMLAttributes: baseService.getHTMLAttributes,
  getSrcSet: baseService.getSrcSet,
  getURL(options) {
    const src = typeof options.src === 'string' ? options.src : options.src.src;
    // ширина из srcset; у основного src без widths — своя ширина кадра
    const width = options.width ?? (typeof options.src === 'string' ? undefined : options.src.width);
    // не наш источник (svg из public, чужой адрес) — отдаём как есть, ничего не режем
    return photoUrl(src, width) ?? src;
  },
};

export default service;
