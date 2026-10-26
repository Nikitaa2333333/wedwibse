// Клиент базы кабинета (PocketBase) для экранов /profi/… — без SDK:
// десяток запросов не стоит новой клиентской зависимости (CLAUDE.md).
// Кабинет и админка — рабочий инструмент за входом, не витрина: данные
// здесь рисует браузер, в поиск эти страницы не идут (noindex).
//
// Адрес базы: на сайте — тот же домен (`/api/` проксирует nginx),
// для разработки — PUBLIC_PB_URL=http://127.0.0.1:8090 в окружении.
// Учётки две и не пересекаются: подрядчик (vendors, вход Telegram)
// и модератор (moderators, почта + пароль) — токены лежат раздельно.

export const PB_URL = (import.meta.env.PUBLIC_PB_URL || '').replace(/\/$/, '');

export type Role = 'vendor' | 'moderator';

const KEY: Record<Role, string> = { vendor: 'wed-cab-vendor', moderator: 'wed-cab-moderator' };

export interface Session {
  token: string;
  record: Record<string, any>;
}

export function session(role: Role): Session | null {
  try {
    const raw = localStorage.getItem(KEY[role]);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function saveSession(role: Role, s: Session | null) {
  try {
    if (s) localStorage.setItem(KEY[role], JSON.stringify(s));
    else localStorage.removeItem(KEY[role]);
  } catch {}
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** запрос к базе от имени роли; 401 — сессия кончилась, выходим */
export async function api<T = any>(role: Role | null, method: string, path: string, body?: unknown): Promise<T> {
  const s = role ? session(role) : null;
  const isForm = body instanceof FormData;
  const r = await fetch(PB_URL + path, {
    method,
    headers: {
      ...(s ? { authorization: s.token } : {}),
      ...(body && !isForm ? { 'content-type': 'application/json' } : {}),
    },
    body: isForm ? (body as FormData) : body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {}
  if (!r.ok) {
    if (r.status === 401 && role) saveSession(role, null);
    // ошибки полей PocketBase кладёт в data: { поле: { message } }
    const fields = json?.data && typeof json.data === 'object'
      ? Object.entries(json.data).map(([k, v]: [string, any]) => `${k}: ${v?.message ?? ''}`).join('; ')
      : '';
    throw new ApiError(r.status, [json?.message, fields].filter(Boolean).join(' ') || `Ошибка ${r.status}`);
  }
  return json as T;
}

/** без сессии нужной роли — на её экран входа */
export function requireSession(role: Role): Session | null {
  const s = session(role);
  if (!s) {
    const back = encodeURIComponent(location.pathname + location.search);
    location.replace(role === 'vendor' ? `/profi/vhod/?next=${back}` : `/profi/admin/vhod/?next=${back}`);
    return null;
  }
  return s;
}

/** закрытые файлы (фото черновика) открываются только с коротким токеном файла */
export async function fileToken(role: Role): Promise<string> {
  const r = await api<{ token: string }>(role, 'POST', '/api/files/token');
  return r.token;
}

export function fileUrl(rec: { collectionId: string; id: string }, name: string, opts: { thumb?: string; token?: string } = {}) {
  const q = new URLSearchParams();
  if (opts.thumb) q.set('thumb', opts.thumb);
  if (opts.token) q.set('token', opts.token);
  const qs = q.toString();
  return `${PB_URL}/api/files/${rec.collectionId}/${rec.id}/${encodeURIComponent(name)}${qs ? '?' + qs : ''}`;
}

/** статус ревизии словом и цветом (CLAUDE.md, «Кабинет — это не сайт») */
export const REV_STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Черновик', cls: '' },
  review: { label: 'На проверке', cls: 'status--info' },
  rejected: { label: 'Вернули', cls: 'status--bad' },
  approved: { label: 'Опубликована', cls: 'status--ok' },
};

/** экранирование для innerHTML: всё, что пришло из базы, — чужой текст */
export function esc(v: unknown): string {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
