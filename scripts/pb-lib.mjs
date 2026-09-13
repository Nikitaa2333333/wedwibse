// Общее для pb-seed / pb-pull: доступ к PocketBase по REST без SDK-зависимости.
// Настройки — из .env: PB_URL, PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD.
import { readFile } from 'node:fs/promises';

export async function loadEnv() {
  try {
    for (const line of (await readFile('.env', 'utf8')).split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
    }
  } catch {}
  if (!process.env.PB_URL) throw new Error('PB_URL не задан (.env или окружение)');
  return { url: process.env.PB_URL.replace(/\/$/, ''), email: process.env.PB_ADMIN_EMAIL, password: process.env.PB_ADMIN_PASSWORD };
}

export async function pb(cfg) {
  let token = null;
  if (cfg.email && cfg.password) {
    const r = await fetch(`${cfg.url}/api/collections/_superusers/auth-with-password`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ identity: cfg.email, password: cfg.password }),
    });
    if (!r.ok) throw new Error(`auth: ${r.status} ${await r.text()}`);
    token = (await r.json()).token;
  }
  const headers = (extra = {}) => ({ ...(token ? { authorization: token } : {}), ...extra });
  async function call(method, path, body, isForm = false) {
    const r = await fetch(`${cfg.url}${path}`, {
      method,
      headers: headers(isForm ? {} : body ? { 'content-type': 'application/json' } : {}),
      body: isForm ? body : body ? JSON.stringify(body) : undefined,
    });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${await r.text()}`);
    return r.status === 204 ? true : r.json();
  }
  return {
    url: cfg.url,
    list: (col, query = '') => call('GET', `/api/collections/${col}/records?perPage=500&${query}`),
    first: async (col, filter) => (await call('GET', `/api/collections/${col}/records?perPage=1&filter=${encodeURIComponent(filter)}`))?.items?.[0] ?? null,
    create: (col, form) => call('POST', `/api/collections/${col}/records`, form, form instanceof FormData),
    update: (col, id, form) => call('PATCH', `/api/collections/${col}/records/${id}`, form, form instanceof FormData),
    fileUrl: (rec, file) => `${cfg.url}/api/files/${rec.collectionId}/${rec.id}/${file}`,
    fetch: (path) => fetch(`${cfg.url}${path}`, { headers: headers() }),
  };
}

/** имя файла в PocketBase: `p01_AbC123xy.webp` → `p01.webp` (PB дописывает случайный суффикс) */
export function originalName(pbName) {
  return pbName.replace(/_[A-Za-z0-9]{10}(\.[a-z0-9]+)$/i, '$1');
}
