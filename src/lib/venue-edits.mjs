// Правки владельца площадки «ведём мы» поверх нашей страницы (решение Никиты 09.11).
// Страница — наш JSON из git (в базе page), правки — page.ownerEdits, их кладёт
// хук approveManagedVenue (pb/pb_hooks/lib/cabinet.js): значения строк
// «Характеристик» и «Условий» (по месту at и с проверкой подписи), тарифы залов
// по дням, тип, вместимость, чек. Чистый .mjs: его читает сайт (lib/live-data.ts).
import { TYPE_LABEL } from './cabinet-venue.mjs';

const NBSP = ' ';
const num = (n) => Number(n).toLocaleString('ru-RU').replace(/\s/g, NBSP);

/** объект по пути «blocks.3.terms.0.rows.1» */
function at(root, path) {
  return String(path).split('.').reduce((o, k) => (o == null ? o : o[k]), root);
}

/** страница площадки с правками владельца; правок нет — та же страница */
export function applyVenueEdits(venue, e) {
  if (!e || typeof e !== 'object') return venue;
  const v = JSON.parse(JSON.stringify(venue));
  delete v.ownerEdits;
  // строка меняется, только если на её месте та же подпись: страницу поправили
  // мы — старая правка владельца не встанет в чужую строку
  for (const r of Array.isArray(e.rows) ? e.rows : []) {
    const row = r?.at ? at(v, r.at) : null;
    if (row && typeof row === 'object' && row.label === r.label && String(r.value ?? '').trim()) row.value = String(r.value).trim();
  }
  for (const h of Array.isArray(e.hallTariffs) ? e.hallTariffs : []) {
    const hall = (v.halls ?? []).find((x) => x.id === h?.id);
    if (!hall || !Array.isArray(hall.tariff) || !Array.isArray(h.tariff)) continue;
    hall.tariff = hall.tariff.map((t, i) => {
      const m = h.tariff[i];
      return m && m.day === t.day ? { ...t, rent: m.rent || t.rent, deposit: m.deposit || t.deposit } : t;
    });
  }
  return v;
}

/**
 * Кадры, которые владелец убрал (Никита 09.11: фото «ведём мы» владелец убирает сам).
 * Работает по нашим путям (/venues/…), поэтому — ДО подмены путей на файлы сборки
 * (live-data: mapVenueImages). Файлы не удаляем: на них могут ссылаться залы и блоки.
 * Убранный кадр первого экрана заменяем первым оставшимся из ленты.
 */
export function hideVenuePhotos(page, hidden) {
  const off = new Set((Array.isArray(hidden) ? hidden : []).filter((s) => typeof s === 'string'));
  if (!off.size || !page || typeof page !== 'object') return page;
  const v = JSON.parse(JSON.stringify(page));
  v.gallery = (v.gallery ?? []).filter((g) => !off.has(g?.src));
  const rest = v.gallery.map((g) => g?.src).filter((s) => typeof s === 'string' && /\.(webp|jpe?g|png)$/i.test(s));
  if (v.hero && typeof v.hero === 'object') {
    for (const k of ['image', 'portrait']) {
      if (off.has(v.hero[k])) v.hero[k] = rest.find((s) => s !== v.hero.image && s !== v.hero.portrait) ?? rest[0] ?? v.hero[k];
    }
  }
  return v;
}

/** карточка каталога с правками владельца: тип, вместимость, чек (фильтры каталога) */
export function applyFeedEdits(item, e) {
  if (!e || typeof e !== 'object') return item;
  const out = { ...item };
  if (TYPE_LABEL[e.type]) out.type = TYPE_LABEL[e.type];
  if (Number(e.capacityBanquet) > 0) {
    out.capacityMax = Number(e.capacityBanquet);
    out.capacity = `до ${num(e.capacityBanquet)} гостей`;
  }
  if (Number(e.checkFrom) > 0) {
    out.checkFrom = Number(e.checkFrom);
    out.avgCheck = `от ${num(e.checkFrom)}${NBSP}₽`;
  }
  return out;
}
