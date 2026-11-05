// «Описание» как Apple Заметки (Никита, 05.11.2026) — модель без DOM.
//
// Человек пишет сплошным текстом из трёх видов строк: заголовок, текст,
// пункт списка. Хранение НЕ меняется: текст лежит разделами
// `sections = [{ title, body }]`, как его понимают хук (`parseSection` в
// pb/pb_hooks/lib/cabinet.js), визитка (StoryText) и превью:
//   заголовок → новый раздел;
//   абзацы — через пустую строку, пункт — строка «— …».
// У раздела на сайте одна форма «текст → список → текст после», поэтому
// второй список после «текста после» начинает раздел без заголовка — иначе
// на сайте он слился бы с первым и встал не на своё место.

export type BlockKind = 'h' | 'p' | 'li';
export interface Block { t: BlockKind; text: string }
export interface Section { title: string; body: string }

/** тот же признак пункта, что у хука (BULLET в cabinet.js) */
export const BULLET = /^\s*[—–\-•·*]\s+/;
const clean = (s: unknown) => String(s ?? '').replace(/ /g, ' ').replace(/[ \t]+/g, ' ').trim();

/** разделы из базы → строки редактора */
export function sectionsToBlocks(sections: unknown): Block[] {
  const out: Block[] = [];
  for (const s of Array.isArray(sections) ? sections : []) {
    const title = clean((s as any)?.title);
    if (title) out.push({ t: 'h', text: title });
    for (const para of String((s as any)?.body ?? '').split(/\n\s*\n/)) {
      let plain: string[] = [];
      const flush = () => { if (plain.length) out.push({ t: 'p', text: plain.join(' ') }); plain = []; };
      for (const raw of para.split('\n')) {
        const line = clean(raw);
        if (!line) continue;
        if (BULLET.test(line)) { flush(); out.push({ t: 'li', text: clean(line.replace(BULLET, '')) }); }
        else plain.push(line);
      }
      flush();
    }
  }
  return out;
}

/** строки редактора → разделы для базы */
export function blocksToSections(blocks: Block[]): Section[] {
  const out: { title: string; paras: string[]; list: boolean; after: boolean }[] = [];
  let cur: (typeof out)[number] | null = null;
  const open = (title: string) => { cur = { title, paras: [], list: false, after: false }; out.push(cur); return cur; };
  let lastLi = false;
  for (const b of blocks) {
    const text = clean(b.text);
    if (!text) continue;
    if (b.t === 'h') { open(text); lastLi = false; continue; }
    let c = cur ?? open('');
    if (b.t === 'li') {
      if (c.after && !lastLi) c = open(''); // второй список после «текста после»
      if (lastLi) c.paras[c.paras.length - 1] += `\n— ${text}`;
      else c.paras.push(`— ${text}`);
      c.list = true;
      lastLi = true;
    } else {
      c.paras.push(text);
      if (c.list) c.after = true;
      lastLi = false;
    }
  }
  return out.map((s) => ({ title: s.title, body: s.paras.join('\n\n') }));
}

/** то, что увидит сайт: та же разборка, что parseSection в хуке */
export function storyOf(sections: Section[]) {
  return sections.filter((s) => clean(s.body)).map((sec) => {
    const o: Record<string, unknown> = {};
    const text: string[] = [], list: string[] = [], after: string[] = [];
    if (clean(sec.title)) o.title = clean(sec.title);
    for (const para of sec.body.split(/\n\s*\n/)) {
      let plain: string[] = [];
      const flush = () => { if (plain.length) (list.length ? after : text).push(plain.join(' ')); plain = []; };
      for (const l of para.split('\n').map(clean).filter(Boolean)) {
        if (BULLET.test(l)) { flush(); list.push(clean(l.replace(BULLET, ''))); } else plain.push(l);
      }
      flush();
    }
    if (text.length) o.text = text;
    if (list.length) o.list = list;
    if (after.length) o.after = after;
    return o;
  });
}

// ---------- вставка готового текста ----------
const NUMBERED = /^\s*\d{1,2}[.)]\s+/;
/** короткая строка без точки в конце — похоже на заголовок раздела */
export function looksLikeHeading(line: string, next?: Block): boolean {
  const s = clean(line);
  if (!s || s.length > 60 || !next || next.t === 'h') return false;
  if (/[.,;!?…:»"]$/.test(s)) return false;           // «Что входит:» — подводка к списку, не заголовок
  if (!/^[A-ZА-ЯЁ0-9«"]/.test(s)) return false;
  return s.split(' ').length <= 8;
}

/**
 * Обычный текст (из письма, мессенджера, Word без разметки) → строки.
 * Пустая строка — граница абзаца; «-», «—», «•», «1.» — пункт;
 * короткая отдельная строка без точки — заголовок (guess = true).
 */
export function plainToBlocks(text: string, guess = true): { blocks: Block[]; guessed: number } {
  const paras = String(text ?? '').replace(/\r\n?/g, '\n').split(/\n\s*\n/);
  let guessed = 0;
  const blocks: Block[] = [];
  const cand: number[] = []; // строки, стоящие отдельно, — кандидаты в заголовки
  for (const para of paras) {
    const lines = para.split('\n').map(clean).filter(Boolean);
    let plain: string[] = [];
    const flush = () => { if (plain.length) blocks.push({ t: 'p', text: plain.join(' ') }); plain = []; };
    lines.forEach((l, i) => {
      if (BULLET.test(l) || NUMBERED.test(l)) { flush(); blocks.push({ t: 'li', text: clean(l.replace(BULLET, '').replace(NUMBERED, '')) }); return; }
      // первая строка абзаца без точки, а дальше ещё строки — в тексте
      // с сайта это часто заголовок, вставленный без пустой строки
      if (lines.length === 1) { blocks.push({ t: 'p', text: l }); cand.push(blocks.length - 1); return; }
      if (guess && i === 0 && looksLikeHeading(l, { t: 'p', text: lines[1] })) { blocks.push({ t: 'h', text: l }); guessed++; return; }
      plain.push(l);
    });
    flush();
  }
  if (guess) for (const i of cand) {
    const b = blocks[i];
    if (b.t === 'p' && looksLikeHeading(b.text, blocks[i + 1])) { b.t = 'h'; guessed++; }
  }
  return { blocks, guessed };
}

/** «1 знак / 2 знака / 5 знаков» */
export function plural(n: number, one: string, few: string, many: string): string {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b === 1) return one;
  if (b >= 2 && b <= 4) return few;
  return many;
}
