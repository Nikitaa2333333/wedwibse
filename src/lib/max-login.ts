// Вход подрядчика через MAX (CABINET.md §23). Окна входа, как у Telegram,
// у MAX нет — вход через бота: база выдаёт одноразовый код, кнопка
// открывает max.ru/<бот>?start=<код>, человек жмёт «Начать», вебхук бота
// подтверждает аккаунт (pb_hooks/lib/max.js), а страница всё это время
// спрашивает базу, подтверждён ли код. Дальше — общий signIn (tg-login.ts).
//
// Код берём ЗАРАНЕЕ, при открытии страницы, и кнопка — обычная ссылка
// target=_blank. Safari на айфоне открывает новую вкладку только прямо по
// нажатию: вкладка, открытая пустой и перенаправленная после ответа базы,
// так и оставалась about:blank (31.10.2026).
//
// PUBLIC_MAX_BOT (никнейм бота) в сборке; без него кнопка остаётся ссылкой
// прототипа.
import { api } from './cabinet-api';
import { signIn, type Pending } from './tg-login';

export const MAX_BOT = import.meta.env.PUBLIC_MAX_BOT || '';

/** спрашиваем базу так часто, пока человек в MAX */
const POLL_MS = 2000;
/** код в базе живёт 15 минут (lib/max.js) — берём новый с запасом */
const REFRESH_MS = 10 * 60 * 1000;

const sleep = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

export interface MaxCode {
  code: string;
  link: string;
}

/**
 * Держит у ссылки свежий код: сразу и затем каждые 10 минут. Возвращает
 * функцию, которая отдаёт текущий код (null — ещё не пришёл).
 */
export function prepareMaxLink(a: HTMLAnchorElement, onError: (m: string) => void): () => MaxCode | null {
  let current: MaxCode | null = null;
  const load = async () => {
    try {
      current = await api<MaxCode>(null, 'POST', '/api/wed/max/start');
      a.href = current.link;
      a.target = '_blank';
      a.rel = 'noopener';
    } catch (err) {
      onError((err as Error).message);
    }
  };
  load();
  setInterval(load, REFRESH_MS);
  return () => current;
}

/** человек ушёл в MAX с этим кодом — ждём, пока бот его подтвердит */
export async function waitMaxSignIn(code: string, p: Omit<Pending, 'tg' | 'max'>): Promise<'in' | 'needs-accept'> {
  const until = Date.now() + 15 * 60 * 1000;
  while (Date.now() < until) {
    await sleep(POLL_MS);
    const out = await signIn({ ...p, max: code });
    if (out !== 'waiting') return out;
  }
  throw new Error('Вход через MAX устарел — нажмите кнопку ещё раз.');
}
