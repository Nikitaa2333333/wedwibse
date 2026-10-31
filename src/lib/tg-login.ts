// Вход подрядчика через Telegram (CABINET.md §22): своя кнопка открывает
// окно Telegram (Telegram.Login.auth — тот же механизм, что у виджета
// входа, но без чужой кнопки в вёрстке), данные с подписью уходят в базу,
// хук проверяет подпись токеном бота (pb_hooks/lib/telegram.js).
//
// Скрипт telegram.org грузим только по нажатию: на остальных страницах
// и до нажатия его нет. Номер бота (цифры до «:» в токене) не секрет —
// PUBLIC_TG_BOT_ID в сборке; без него кнопка остаётся ссылкой прототипа.
import { api, saveSession } from './cabinet-api';

export const TG_BOT_ID = import.meta.env.PUBLIC_TG_BOT_ID || '';

const PENDING = 'wed-cab-tg-pending';

declare global {
  interface Window {
    Telegram?: { Login: { auth: (o: Record<string, unknown>, cb: (u: Record<string, unknown> | false) => void) => void } };
  }
}

function loadWidget(): Promise<void> {
  if (window.Telegram?.Login) return Promise.resolve();
  return new Promise((ok, fail) => {
    const s = document.createElement('script');
    s.src = 'https://telegram.org/js/telegram-widget.js?22';
    s.async = true;
    s.onload = () => ok();
    s.onerror = () => fail(new Error('Telegram не загрузился — проверьте связь и попробуйте ещё раз.'));
    document.head.append(s);
  });
}

/** окно Telegram → данные пользователя с подписью (null — закрыли окно) */
export async function telegramPopup(): Promise<Record<string, unknown> | null> {
  await loadWidget();
  return new Promise((ok) =>
    window.Telegram!.Login.auth({ bot_id: TG_BOT_ID, request_access: 'write', lang: 'ru' }, (u) => ok(u || null)),
  );
}

/** вход ждёт условий: данные Telegram или код MAX (lib/max-login.ts) */
export interface Pending {
  tg?: Record<string, unknown>;
  max?: string;
  name?: string;
  invite?: string;
  next?: string;
}

export function pending(): Pending | null {
  try {
    const raw = sessionStorage.getItem(PENDING);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Данные Telegram → база. Учётка есть — вход. Нет — запоминаем данные
 * и ведём на экран условий: учётка появится только с их подписью.
 */
export async function signIn(p: Pending & { accept?: boolean }): Promise<'in' | 'needs-accept' | 'waiting'> {
  const common = { accept: p.accept === true, invite: p.invite || undefined };
  const res = p.max
    ? await api(null, 'POST', '/api/wed/max', { code: p.max, ...common })
    : await api(null, 'POST', '/api/wed/telegram', { tg: p.tg, ...common });
  if (res?.status === 'waiting') return 'waiting';
  if (res?.status === 'needs-accept') {
    const { accept: _, ...keep } = p;
    try { sessionStorage.setItem(PENDING, JSON.stringify({ ...keep, name: res.name || p.name })); } catch {}
    return 'needs-accept';
  }
  saveSession('vendor', { token: res.token, record: res.record });
  try { sessionStorage.removeItem(PENDING); } catch {}
  return 'in';
}

export function afterLogin(next?: string) {
  // только свои адреса: ?next= не уводит на чужой сайт
  location.href = next && next.startsWith('/profi/') ? next : '/profi/moi/';
}
