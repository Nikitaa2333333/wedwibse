// Вход подрядчика через MAX (CABINET.md §23). Окна входа, как у Telegram,
// у MAX нет — вход через бота: база выдаёт одноразовый код, кнопка
// открывает max.ru/<бот>?start=<код>, человек жмёт «Начать», вебхук бота
// подтверждает аккаунт (pb_hooks/lib/max.js), а страница всё это время
// спрашивает базу, подтверждён ли код. Дальше — общий signIn (tg-login.ts).
//
// PUBLIC_MAX_BOT (никнейм бота) в сборке; без него кнопка остаётся ссылкой
// прототипа.
import { api } from './cabinet-api';
import { signIn, type Pending } from './tg-login';

export const MAX_BOT = import.meta.env.PUBLIC_MAX_BOT || '';

/** спрашиваем базу так часто, пока человек в MAX */
const POLL_MS = 2000;
/** столько живёт код в базе (lib/max.js, CODE_TTL_MIN) */
const GIVE_UP_MS = 15 * 60 * 1000;

const sleep = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

/**
 * Код → MAX → ждём подтверждения. `onLink` получает ссылку в бота: если
 * браузер не дал открыть новую вкладку, страница показывает её кнопкой.
 */
export async function maxSignIn(
  p: Omit<Pending, 'tg' | 'max'>,
  onLink: (link: string) => void,
): Promise<'in' | 'needs-accept'> {
  // вкладку открываем сразу по нажатию: после ожидания ответа базы
  // браузер посчитает её всплывающим окном и не откроет
  const tab = window.open('about:blank', '_blank');
  let res: { code: string; link: string };
  try {
    res = await api(null, 'POST', '/api/wed/max/start');
  } catch (err) {
    tab?.close();
    throw err;
  }
  if (tab) tab.location.href = res.link;
  onLink(res.link);

  const until = Date.now() + GIVE_UP_MS;
  while (Date.now() < until) {
    await sleep(POLL_MS);
    const out = await signIn({ ...p, max: res.code });
    if (out !== 'waiting') return out;
  }
  throw new Error('Вход через MAX устарел — нажмите кнопку ещё раз.');
}
