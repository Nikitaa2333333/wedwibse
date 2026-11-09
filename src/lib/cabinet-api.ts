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
  /** ответ базы как есть — в консоль для разбора, человеку не показываем */
  raw: string;
  constructor(status: number, message: string, raw = '') {
    super(message);
    this.status = status;
    this.raw = raw;
  }
}

// ОШИБКИ ПО-ЧЕЛОВЕЧЕСКИ (05.11.2026, сверка cabinet-ui, правила 14 и 20).
// Раньше человек видел ответ базы как есть: «name: Cannot be blank», «Failed
// to authenticate.», «Ошибка 500». Теперь:
//  - наши хуки (pb/pb_hooks) уже пишут по-русски — их текст идёт как есть;
//  - ошибку поля переводим словарём: какое поле и что с ним сделать;
//  - остальное — по коду ответа: что случилось и что делать сейчас.
// Новое поле анкеты с проверкой в базе — подпись сюда, в FIELD.
const FIELD: Record<string, string> = {
  name: 'Имя', email: 'Почта', password: 'Пароль', passwordConfirm: 'Повтор пароля', phone: 'Телефон',
  slug: 'Адрес страницы', data: 'Анкета', photos: 'Фото', avatar: 'Портрет', url: 'Ссылка',
  comment: 'Комментарий', rejectReason: 'Причина', otpId: 'Код', code: 'Код', status: 'Статус',
};

const CYR = /[а-яё]/i;
const dot = (t: string) => t.replace(/\.\s*$/, '');

function fieldError(key: string, v: any): string {
  const label = FIELD[key] ?? key;
  const code = String(v?.code ?? '');
  const msg = String(v?.message ?? '');
  if (CYR.test(msg)) return dot(msg);
  if (code === 'validation_required') return `Заполните поле «${label}»`;
  if (code === 'validation_invalid_email' || code === 'validation_is_email') return 'В адресе почты ошибка — проверьте его';
  if (code === 'validation_not_unique') return key === 'email' ? 'Эта почта уже занята — войдите с ней или укажите другую' : `«${label}» уже занят — нужно другое значение`;
  if (code === 'validation_length_out_of_range' || code.includes('min_text') || code.includes('length')) return `«${label}»: слишком короткое или длинное значение`;
  if (code.includes('file_size')) return 'Файл слишком большой — до 15 МБ';
  if (code.includes('file_mime') || code.includes('mime')) return 'Такой файл не подходит — нужна фотография JPG, PNG или WebP';
  if (code.includes('max_select') || code.includes('too_many')) return `«${label}»: слишком много`;
  return `Проверьте поле «${label}»`;
}

/** текст ошибки для человека: что случилось и что делать сейчас */
export function humanError(status: number, json: any): string {
  const msg = String(json?.message ?? '');
  const data = json?.data && typeof json.data === 'object' ? Object.entries(json.data) : [];
  if (data.length) return data.map(([k, v]) => fieldError(k, v)).join('. ');
  if (CYR.test(msg)) return dot(msg);
  if (status === 0) return 'Нет связи с сервером. Проверьте интернет и повторите';
  if (status === 401) return 'Вход истёк. Войдите заново';
  if (status === 403) return 'На это нет прав. Если это ошибка, войдите заново';
  if (status === 404) return 'Не нашли — возможно, это уже удалили. Обновите страницу';
  if (status === 413) return 'Файл слишком большой — до 15 МБ';
  if (status === 429) return 'Слишком много попыток. Подождите пару минут и повторите';
  if (status >= 500) return 'Сервер не ответил. Повторите через минуту';
  if (/authenticat/i.test(msg)) return 'Неверная почта или пароль';
  return 'Не получилось. Повторите или обновите страницу';
}

/** текст любой пойманной ошибки — для catch на экранах */
export function errText(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof TypeError) return humanError(0, null);
  const m = String((err as Error)?.message ?? '');
  return CYR.test(m) ? dot(m) : 'Не получилось. Повторите или обновите страницу';
}

/**
 * запрос к базе от имени роли; 401 — сессия кончилась, выходим.
 * keepalive — запрос доживёт, даже если страницу закрыли (отложенные
 * действия с «Отменить», lib/cab-ui.ts → later); тело до 64 КБ.
 */
export async function api<T = any>(role: Role | null, method: string, path: string, body?: unknown, opts: { keepalive?: boolean } = {}): Promise<T> {
  // демо-режим кабинета без входа — только дев-сервер (lib/cabinet-demo.ts)
  if (import.meta.env.DEV && (await import('./cabinet-demo')).demoOn()) {
    return (await import('./cabinet-demo')).demoApi(method, path, body);
  }
  const s = role ? session(role) : null;
  const isForm = body instanceof FormData;
  let r: Response;
  try {
    r = await fetch(PB_URL + path, {
      method,
      headers: {
        ...(s ? { authorization: s.token } : {}),
        ...(body && !isForm ? { 'content-type': 'application/json' } : {}),
      },
      body: isForm ? (body as FormData) : body ? JSON.stringify(body) : undefined,
      keepalive: opts.keepalive,
    });
  } catch (err) {
    // нет сети, сервер недоступен, обрыв — fetch падает без ответа
    throw new ApiError(0, humanError(0, null), String(err));
  }
  const text = await r.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {}
  if (!r.ok) {
    if (r.status === 401 && role) saveSession(role, null);
    if (text) console.warn(`[api] ${method} ${path} → ${r.status}`, text);
    throw new ApiError(r.status, humanError(r.status, json), text);
  }
  return json as T;
}

/**
 * Загрузка файлов с ходом (09.11): fetch не сообщает, сколько ушло, поэтому
 * XHR с upload.onprogress. onPart(0…1) — доля отправленного этой порции.
 * Ошибки — те же ApiError, что у api().
 */
export async function apiUpload<T = any>(role: Role, path: string, body: FormData, onPart: (part: number) => void): Promise<T> {
  if (import.meta.env.DEV && (await import('./cabinet-demo')).demoOn()) {
    onPart(1);
    return (await import('./cabinet-demo')).demoApi('PATCH', path, body);
  }
  const s = session(role);
  return new Promise<T>((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('PATCH', PB_URL + path);
    if (s) x.setRequestHeader('authorization', s.token);
    x.upload.onprogress = (e) => { if (e.lengthComputable) onPart(e.loaded / e.total); };
    x.onerror = () => reject(new ApiError(0, humanError(0, null), 'xhr error'));
    x.onload = () => {
      let json: any = null;
      try { json = x.responseText ? JSON.parse(x.responseText) : null; } catch {}
      if (x.status >= 200 && x.status < 300) return resolve(json as T);
      if (x.status === 401) saveSession(role, null);
      reject(new ApiError(x.status, humanError(x.status, json), x.responseText));
    };
    x.send(body);
  });
}

/** демо-кадр (дев): градиент-заглушка, синхронно — без загрузки модуля демо */
function demoPic(name: string): string {
  const h = [...name].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 500'><rect width='400' height='500' fill='hsl(${h},30%,72%)'/></svg>`)}`;
}

/** без сессии нужной роли — на её экран входа */
export function requireSession(role: Role): Session | null {
  // дев: ?demo в адресе — учётка демо до запроса сессии (lib/cabinet-demo.ts)
  if (import.meta.env.DEV && /[?&]demo(?!=0)/.test(location.search)) {
    try {
      if (role === 'vendor') localStorage.setItem('wed-cab-vendor', JSON.stringify({ token: 'demo', record: { id: 'demo-vendor', name: 'Анна Дремина' } }));
      else localStorage.setItem('wed-cab-moderator', JSON.stringify({ token: 'demo', record: { id: 'demo-mod', name: 'Никита', email: 'mod@example.ru' } }));
      sessionStorage.setItem('wed-cab-demo', '1');
    } catch {}
  }
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
  if (import.meta.env.DEV && rec.collectionId === 'demo') return demoPic(name);
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
