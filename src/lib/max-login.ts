// Вход подрядчика через MAX (docs/cabinet/CABINET.md §23). Окна входа, как у Telegram,
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
// «ИНОГДА НЕ ПЕРЕХОДИТ» (разбор журналов базы 05.11.2026). Бот подтверждал
// вход, а страница уже не спрашивала: (1) первый же сбой связи обрывал
// ожидание — телефон, уходя в MAX, рвёт запрос свёрнутой вкладки (31.10,
// Android: один опрос, «Начать» через 14 минут — в пустоту); (2) айфон,
// вернувшись из MAX, перезагружал вкладку, и ожидание терялось вместе с ней
// (31.10: три подтверждения бота без единого опроса страницы). Теперь код,
// с которым ушли в MAX, лежит в localStorage до 15 минут: любая открытая
// страница входа подхватывает ожидание (после перезагрузки, возврата
// «назад», в другой вкладке сайта), сбои связи переждаются, а вернувшись
// на вкладку, страница спрашивает базу сразу, не дожидаясь таймера.
//
// PUBLIC_MAX_BOT (никнейм бота) в сборке; без него кнопка остаётся ссылкой
// прототипа.
import { api, ApiError } from './cabinet-api';
import { signIn, type Pending } from './tg-login';

export const MAX_BOT = import.meta.env.PUBLIC_MAX_BOT || '';

/** спрашиваем базу так часто, пока человек в MAX */
const POLL_MS = 2000;
/** код в базе живёт 15 минут (lib/max.js) */
const CODE_TTL_MS = 15 * 60 * 1000;
/** берём новый с запасом */
const REFRESH_MS = 10 * 60 * 1000;
/** код, с которым ушли в MAX, — общий для всех вкладок сайта */
const WAIT_KEY = 'wed-cab-max-wait';

export interface MaxCode {
  code: string;
  link: string;
}

type Wait = Omit<Pending, 'tg' | 'max'> & { code: string; at: number };

/** пауза, которую обрывает возврат на вкладку: вернулся — спрашиваем сразу */
function nap(ms: number): Promise<void> {
  return new Promise((ok) => {
    const done = () => { clearTimeout(t); document.removeEventListener('visibilitychange', wake); ok(); };
    const wake = () => { if (document.visibilityState === 'visible') done(); };
    const t = setTimeout(done, ms);
    document.addEventListener('visibilitychange', wake);
  });
}

/** сбой связи или сервера — переждать; ответ базы по существу (код устарел) — нет */
function transient(err: unknown): boolean {
  if (!(err instanceof ApiError)) return true; // fetch упал без ответа
  return err.status === 0 || err.status === 429 || err.status >= 500;
}

function saveWait(w: Wait | null) {
  try {
    if (w) localStorage.setItem(WAIT_KEY, JSON.stringify(w));
    else localStorage.removeItem(WAIT_KEY);
  } catch {}
}

/** незаконченное ожидание входа через MAX (ушли в MAX, страница перезагрузилась) */
export function pendingMax(): Wait | null {
  try {
    const w = JSON.parse(localStorage.getItem(WAIT_KEY) || 'null') as Wait | null;
    if (w && typeof w.code === 'string' && Date.now() - w.at < CODE_TTL_MS) return w;
  } catch {}
  saveWait(null);
  return null;
}

/**
 * Держит у ссылки свежий код: сразу и затем каждые 10 минут, а также при
 * возврате на вкладку, если код успел состариться (таймеры свёрнутой
 * вкладки телефон замораживает). Возвращает функцию, которая отдаёт текущий
 * код (null — ещё не пришёл).
 */
export function prepareMaxLink(a: HTMLAnchorElement, onError: (m: string) => void): () => MaxCode | null {
  let current: MaxCode | null = null;
  let at = 0;
  const load = async () => {
    try {
      current = await api<MaxCode>(null, 'POST', '/api/wed/max/start');
      at = Date.now();
      a.href = current.link;
      a.target = '_blank';
      a.rel = 'noopener';
    } catch (err) {
      onError((err as Error).message);
    }
  };
  load();
  setInterval(load, REFRESH_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && at && Date.now() - at > REFRESH_MS) load();
  });
  return () => (current && Date.now() - at < CODE_TTL_MS ? current : null);
}

/** человек ушёл в MAX с этим кодом — ждём, пока бот его подтвердит */
export async function waitMaxSignIn(code: string, p: Omit<Pending, 'tg' | 'max'>, at = Date.now()): Promise<'in' | 'needs-accept'> {
  saveWait({ ...p, code, at });
  const until = at + CODE_TTL_MS;
  try {
    while (Date.now() < until) {
      await nap(POLL_MS);
      let out;
      try {
        out = await signIn({ ...p, max: code });
      } catch (err) {
        if (transient(err)) continue;
        throw err;
      }
      if (out !== 'waiting') return out;
    }
    throw new Error('Вход через MAX устарел — нажмите кнопку ещё раз.');
  } finally {
    saveWait(null);
  }
}
