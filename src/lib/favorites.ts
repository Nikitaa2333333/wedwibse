// ============================================================
// ИЗБРАННОЕ — общее хранилище для всех каталогов (площадки,
// подрядчики по категориям). До появления бэкенда живёт в
// localStorage: каждая карточка сохраняет свой снимок данных,
// раздел «Избранное» рендерит список из этого снимка,
// ничего заново не запрашивая.
// ============================================================

export interface FavoriteItem {
  /** уникален в рамках каталога: `${cat}:${slug|name}` */
  id: string;
  cat: string;
  /** подпись категории для вкладки и таблицы сравнения */
  catLabel: string;
  name: string;
  /** одна строка под именем (тип · город, стиль и т.п.) */
  meta: string;
  price: string;
  rating: number;
  img: string;
  href: string;
  /** момент добавления (ms), проставляется в toggleFavorite; у старых записей может отсутствовать */
  addedAt?: number;
}

const KEY = 'wed:favorites';
export const STORAGE_KEY = KEY;
export const CHANGE_EVENT = 'wed:favorites-change';

export function getFavorites(): FavoriteItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as FavoriteItem[]) : [];
  } catch {
    return [];
  }
}

export function isFavorited(id: string): boolean {
  return getFavorites().some((f) => f.id === id);
}

/** Добавляет или убирает элемент, возвращает новое состояние (true = теперь в избранном) */
export function toggleFavorite(item: FavoriteItem): boolean {
  const list = getFavorites();
  const i = list.findIndex((f) => f.id === item.id);
  const nowSaved = i < 0;

  if (nowSaved) list.push({ ...item, addedAt: Date.now() });
  else list.splice(i, 1);

  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  if (nowSaved) countFavorite(item.href);
  return nowSaved;
}

/**
 * Статистика карточки (14.11.2026, docs/cabinet/STATS.md): «добавили в избранное»
 * +1 к счётчику дня в базе — подрядчик видит это в кабинете. Только адрес
 * карточки, без учётки и персональных данных; sendBeacon не держит страницу.
 * Убрали из избранного — не вычитаем: считаем интерес, а не текущий список.
 */
function countFavorite(href: string | undefined) {
  if (!href) return;
  try {
    const base = String(import.meta.env.PUBLIC_PB_URL || '').replace(/\/$/, '');
    const body = new Blob([JSON.stringify({ url: new URL(href, location.origin).href })], { type: 'application/json' });
    navigator.sendBeacon?.(`${base}/api/wed/hit`, body);
  } catch {}
}

export function removeFavorite(id: string): void {
  const list = getFavorites().filter((f) => f.id !== id);
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}
