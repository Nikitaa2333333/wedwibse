// ============================================================
// ВТОРИЧНЫЙ ОТБОР В «ИЗБРАННОМ» — финалисты по направлениям.
// Лайк на карточке — первичный отбор (lib/favorites.ts). Здесь второй
// заход: по каждой папке (площадки, ведущие, …) человек проходит
// карточки по одной — «мимо» / «в финал», — а финалисты идут в таблицу
// сравнения и в одну заявку на всех.
//
// Хранилище — localStorage, тот же приём, что у избранного: ключ рядом,
// событие смены, чтение при каждом обращении. Храним только ВЕРДИКТЫ
// (id → да/нет) в порядке принятия — сами карточки живут в избранном,
// второго снимка данных не заводим. Карточку убрали из избранного —
// её вердикт просто перестаёт на что-либо указывать.
// ============================================================

export type Verdict = 'yes' | 'no';

export interface Decision {
  id: string;
  verdict: Verdict;
}

/** по папке (cat) — список решений в порядке принятия */
type Shortlist = Record<string, Decision[]>;

const KEY = 'wed:shortlist';
export const SHORTLIST_KEY = KEY;
export const SHORTLIST_EVENT = 'wed:shortlist-change';

function read(): Shortlist {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Shortlist) : {};
  } catch {
    return {};
  }
}

function write(data: Shortlist): void {
  localStorage.setItem(KEY, JSON.stringify(data));
  window.dispatchEvent(new CustomEvent(SHORTLIST_EVENT));
}

/** вердикты папки: id → да/нет */
export function getVerdicts(cat: string): Map<string, Verdict> {
  const list = read()[cat] ?? [];
  return new Map(list.map((d) => [d.id, d.verdict]));
}

/** принять решение по карточке (повторное — перезаписывает прежнее) */
export function decide(cat: string, id: string, verdict: Verdict): void {
  const data = read();
  const list = (data[cat] ?? []).filter((d) => d.id !== id);
  list.push({ id, verdict });
  data[cat] = list;
  write(data);
}

/** отменить последнее решение в папке; возвращает отменённое решение (карточка вернулась в очередь) */
export function undoLast(cat: string): Decision | null {
  const data = read();
  const list = data[cat] ?? [];
  const last = list.pop();
  if (!last) return null;
  data[cat] = list;
  write(data);
  return last;
}

/** начать отбор в папке заново */
export function resetShortlist(cat: string): void {
  const data = read();
  delete data[cat];
  write(data);
}
