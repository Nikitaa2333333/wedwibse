// Сравнение текста по словам для экрана модератора (CABINET.md §12.5):
// удалённое — красным, добавленное — зелёным. Считается на сборке (вживую —
// на сервере при открытии правки), в браузер уходит готовая разметка.
// Длина разделов карточки — сотни слов, поэтому хватает простого LCS
// без библиотек: n·m на раздел, а не на всю карточку.

export type DiffPart = { kind: 'same' | 'del' | 'add'; text: string };

/** Слова вместе с пробелом после них — так склейка частей даёт исходный текст. */
const words = (s: string) => s.match(/\S+\s*/g) ?? [];
const bare = (w: string) => w.trim();

export function wordDiff(before: string, after: string): DiffPart[] {
  const a = words(before);
  const b = words(after);
  // lcs[i][j] — длина общей подпоследовательности хвостов a[i..], b[j..]
  const lcs = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      lcs[i][j] = bare(a[i]) === bare(b[j]) ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);

  const out: DiffPart[] = [];
  const push = (kind: DiffPart['kind'], text: string) => {
    const last = out[out.length - 1];
    if (last?.kind === kind) last.text += text;
    else out.push({ kind, text });
  };
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (bare(a[i]) === bare(b[j])) { push('same', b[j]); i++; j++; }
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) push('del', a[i++]);
    else push('add', b[j++]);
  }
  while (i < a.length) push('del', a[i++]);
  while (j < b.length) push('add', b[j++]);
  return out;
}

/** Доля изменённых слов от прежнего текста — по ней хук выбирает полосу (≤ ~15 % — зелёная). */
export function changedShare(parts: DiffPart[]): { changed: number; total: number } {
  let changed = 0;
  let total = 0;
  for (const p of parts) {
    const n = words(p.text).length;
    if (p.kind !== 'add') total += n;
    if (p.kind !== 'same') changed += n;
  }
  return { changed, total };
}
