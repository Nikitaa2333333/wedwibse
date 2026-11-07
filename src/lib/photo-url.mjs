// ============================================================
// СЕРВИС ФОТО — адреса нарезанных кадров (docs/PHOTO-SERVICE.md, 07.11.2026).
//
// Принцип: фото готовится один раз — когда попадает к нам, а не когда его
// смотрят. Режет imgproxy (отдельная служба на сервере), а не программа
// страниц. Этот модуль — ЕДИНСТВЕННОЕ место, где строится адрес варианта:
// им пользуются и страницы (src/lib/photo-service.ts), и обработчик нарезки
// (scripts/photo-worker.mjs). Адрес у обоих обязан совпадать байт в байт —
// иначе заранее нарезанный файл не найдётся.
//
// Адрес варианта:      /ph/<ширина>/<вид>/<путь>
//   a — кадр сборки:   /ph/800/a/g4.DvL5Wwhm.webp        ← /_astro/g4.DvL5Wwhm.webp
//   f — файл базы:     /ph/800/f/<коллекция>/<запись>/<имя> ← /api/files/…
//   p — превью анкеты: /ph/800/p?t=…&n=…                  ← /api/wed/preview-file?…
// На диске (nginx, proxy_store) вариант лежит по ключу storeKey(): файл базы —
// по одному имени, без коллекции и записи. Так кадр, нарезанный по «Готово»
// из ревизии, находится и после одобрения: хук переносит файлы в карточку
// с тем же именем (getReuploadableFile(…, true), pb/pb_hooks/lib/cabinet.js).
// Превью не хранится: кадры черновика режутся на лету и живут в кэше nginx.
// ============================================================

/**
 * Лестница ширин — объединение всех наборов IMG_WIDTHS (src/lib/images.ts).
 * Новая ширина в IMG_WIDTHS — сюда же, иначе она округлится вверх до соседней
 * (страница не сломается, но получит кадр крупнее нужного). Тот же список —
 * в пресетах imgproxy и в регулярке nginx (deploy/photo/).
 */
export const PHOTO_WIDTHS = [220, 320, 360, 440, 480, 560, 640, 720, 800, 900, 1100, 1200, 1400, 1800, 2400];

/** ширина из srcset → ближайшая ступень лестницы не меньше её (потолок — 2400) */
export function snapWidth(w) {
  const n = Math.round(Number(w)) || PHOTO_WIDTHS[PHOTO_WIDTHS.length - 1];
  return PHOTO_WIDTHS.find((x) => x >= n) ?? PHOTO_WIDTHS[PHOTO_WIDTHS.length - 1];
}

const RE_ASTRO = /^(?:https?:\/\/[^/]+)?\/_astro\/([^/?#]+\.(?:webp|jpe?g|png|avif))$/i;
const RE_FILES = /^(?:https?:\/\/[^/]+)?\/api\/files\/([a-z0-9_]+)\/([a-z0-9]+)\/([^/?#]+)$/i;
const RE_PREVIEW = /^(?:https?:\/\/[^/]+)?\/api\/wed\/preview-file\?(.+)$/i;

/** источник кадра (адрес из ImageMetadata.src) → { kind, … } или null, если это не наш кадр */
export function parseSource(src) {
  const s = String(src || '');
  let m;
  if ((m = s.match(RE_ASTRO))) return { kind: 'a', file: m[1] };
  if ((m = s.match(RE_FILES))) return { kind: 'f', coll: m[1], rec: m[2], name: decodeURIComponent(m[3]) };
  if ((m = s.match(RE_PREVIEW))) return { kind: 'p', query: m[1] };
  return null;
}

/** публичный адрес варианта; null — источник не наш (страница оставит адрес как есть) */
export function photoUrl(src, width) {
  const p = typeof src === 'string' ? parseSource(src) : src;
  if (!p) return null;
  const w = snapWidth(width);
  if (p.kind === 'a') return `/ph/${w}/a/${p.file}`;
  if (p.kind === 'f') return `/ph/${w}/f/${p.coll}/${p.rec}/${encodeURIComponent(p.name)}`;
  return `/ph/${w}/p?${p.query}`;
}

/** где вариант лежит на диске (относительно корня хранилища); у превью — нигде */
export function storeKey(p, width) {
  const w = snapWidth(width);
  if (p.kind === 'a') return `${w}/a/${p.file}`;
  if (p.kind === 'f') return `${w}/f/${p.name}`;
  return null;
}

/** откуда imgproxy берёт оригинал (корень IMGPROXY_LOCAL_FILESYSTEM_ROOT: site → _astro, pb → storage базы) */
export function imgproxySource(p) {
  if (p.kind === 'a') return `local:///site/${p.file}`;
  if (p.kind === 'f') return `local:///pb/${p.coll}/${p.rec}/${p.name}`;
  return null;
}
