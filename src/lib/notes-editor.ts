// «Описание» как Apple Заметки (Никита, 05.11.2026) — поле в браузере.
//
// contenteditable с жёстким набором: h3 (заголовок), p (текст), ul > li
// (пункт). Первая строка пустого текста — сразу заголовок, Enter после
// него — обычный текст (как в Заметках). Над клавиатурой — капсула «Aa»
// и «Список»; в «Aa» ровно три стиля. Жирного, цветов и шрифтов нет: на
// сайте всё рисует наша типографика (StoryText).
//
// Любая правка, после которой в поле оказалось что-то кроме этих трёх
// видов строк (браузер вставил span при склейке строк и т.п.), — поле
// пересобирается из модели с сохранением курсора. Модель и перевод
// в разделы базы — lib/notes-model.ts.
import type { Block, BlockKind } from './notes-model';
import { plainToBlocks, looksLikeHeading } from './notes-model';
import { later as undoable, LIST_ICON } from './cab-ui';

const TAG: Record<BlockKind, string> = { h: 'h3', p: 'p', li: 'li' };
const BLOCK_TAGS = /^(P|DIV|H[1-6]|LI|UL|OL|BLOCKQUOTE|SECTION|ARTICLE|HEADER|FOOTER|MAIN|ASIDE|TABLE|TBODY|THEAD|TR|TD|TH|DL|DT|DD|FIGURE|FIGCAPTION|PRE|ADDRESS|NAV)$/;
const SKIP_TAGS = /^(SCRIPT|STYLE|HEAD|META|TITLE|LINK|IMG|SVG|VIDEO|AUDIO|IFRAME|OBJECT|NOSCRIPT|TEMPLATE|BUTTON|INPUT|SELECT|TEXTAREA|CANVAS)$/;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const flat = (s: string) => s.replace(/[\r\n\t]+/g, ' ');

/** разметка поля из строк; пустая строка держит высоту через <br> */
export function blocksHtml(blocks: Block[]): string {
  let html = '', inList = false;
  for (const b of blocks) {
    if (b.t === 'li' && !inList) { html += '<ul>'; inList = true; }
    if (b.t !== 'li' && inList) { html += '</ul>'; inList = false; }
    html += `<${TAG[b.t]}>${b.text ? esc(b.text) : '<br>'}</${TAG[b.t]}>`;
  }
  return html + (inList ? '</ul>' : '');
}

/**
 * Любая разметка (поле после правки браузером, HTML из буфера) → строки.
 * Заголовки h1–h6 → заголовок, li → пункт, остальные блоки → текст,
 * всё строчное (жирное, ссылки, цвета) разворачивается в текст.
 * `boldHeads` — для вставки: короткий абзац целиком жирным = заголовок.
 */
export function domToBlocks(root: Node, boldHeads = false): Block[] {
  const out: Block[] = [];
  let buf = '';
  let bufBold = true; // весь текст абзаца жирный
  const flush = (t: BlockKind = 'p') => {
    const text = flat(buf).replace(/\s+/g, ' ').trim();
    if (text) out.push({ t: boldHeads && t === 'p' && bufBold && looksLikeHeading(text, { t: 'p', text: 'x' }) ? 'h' : t, text });
    buf = ''; bufBold = true;
  };
  const isBold = (el: Element) => /^(B|STRONG)$/.test(el.tagName) || /font-weight:\s*(bold|[6-9]00)/.test(el.getAttribute('style') ?? '');
  const walk = (n: Node, bold: boolean) => {
    if (n.nodeType === 3) {
      const v = n.nodeValue ?? '';
      if (v.trim() && !bold) bufBold = false;
      buf += v;
      return;
    }
    if (n.nodeType !== 1) return;
    const el = n as Element;
    const tag = el.tagName;
    if (SKIP_TAGS.test(tag)) return;
    if (tag === 'BR') { flush(); return; }
    // Google Docs кладёт весь документ в <b style="font-weight:normal">
    const b = /font-weight:\s*(normal|[1-5]00)/.test(el.getAttribute('style') ?? '') ? false : bold || isBold(el);
    if (/^H[1-6]$/.test(tag)) { flush(); buf = el.textContent ?? ''; flush('h'); return; }
    if (tag === 'LI') {
      flush();
      // вложенный список внутри пункта — отдельными пунктами следом
      const nested: Element[] = [];
      el.childNodes.forEach((c) => { if (c.nodeType === 1 && /^(UL|OL)$/.test((c as Element).tagName)) nested.push(c as Element); else walk(c, b); });
      flush('li');
      nested.forEach((x) => walk(x, b));
      return;
    }
    const block = BLOCK_TAGS.test(tag);
    if (block) flush();
    el.childNodes.forEach((c) => walk(c, b));
    if (block) flush();
  };
  root.childNodes.forEach((c) => walk(c, false));
  flush();
  return out;
}

export interface NotesOptions {
  /** поле (div[contenteditable]) */
  ed: HTMLElement;
  /** капсула «Aa» и «Список» */
  bar: HTMLElement;
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
}

/** поле «Описания»: строки, капсула над клавиатурой, вставка */
export function mountNotes(o: NotesOptions) {
  const { ed, bar } = o;
  ed.innerHTML = blocksHtml(o.blocks.length ? o.blocks : [{ t: 'h', text: '' }]);

  // ---------- модель и курсор ----------
  const els = () => [...ed.querySelectorAll<HTMLElement>(':scope > h3, :scope > p, :scope > ul > li')];
  const kindOf = (el: Element): BlockKind => (el.tagName === 'H3' ? 'h' : el.tagName === 'LI' ? 'li' : 'p');
  const read = (): Block[] => els().map((el) => ({ t: kindOf(el), text: flat(el.textContent ?? '') }));
  const empty = () => !read().some((b) => b.text.trim());

  /** поле состоит только из h3 / p / ul>li с текстом внутри */
  function valid(): boolean {
    for (const c of ed.childNodes) {
      if (c.nodeType === 3) { if ((c.nodeValue ?? '').trim()) return false; continue; }
      if (c.nodeType !== 1) return false;
      const el = c as Element;
      if (el.tagName === 'UL') {
        for (const li of el.childNodes) if (li.nodeType !== 1 || (li as Element).tagName !== 'LI' || !plainInside(li as Element)) return false;
      } else if (!/^(H3|P)$/.test(el.tagName) || !plainInside(el)) return false;
    }
    return ed.childNodes.length > 0;
  }
  const plainInside = (el: Element) => [...el.childNodes].every((n) => n.nodeType === 3 || (n as Element).tagName === 'BR');

  /** где курсор: номер строки и смещение в её тексте */
  type Pos = { i: number; off: number };
  function posOf(node: Node | null, offset: number): Pos | null {
    if (!node || !ed.contains(node)) return null;
    const list = els();
    let el: Node | null = node;
    while (el && el !== ed && !list.includes(el as HTMLElement)) el = el.parentNode;
    if (!el || el === ed) {
      // курсор на уровне самого поля: между строками
      if (node === ed) { const k = Math.min(offset, list.length - 1); return k < 0 ? null : { i: k, off: 0 }; }
      return null;
    }
    const r = document.createRange();
    r.selectNodeContents(el);
    r.setEnd(node, offset);
    return { i: list.indexOf(el as HTMLElement), off: flat(r.toString()).length };
  }
  function selection(): { a: Pos; b: Pos } | null {
    const s = getSelection();
    if (!s || !s.rangeCount) return null;
    const a = posOf(s.anchorNode, s.anchorOffset), b = posOf(s.focusNode, s.focusOffset);
    if (!a || !b) return null;
    return a.i < b.i || (a.i === b.i && a.off <= b.off) ? { a, b } : { a: b, b: a };
  }
  function place(p: Pos, p2: Pos = p) {
    const list = els();
    const at = (q: Pos): [Node, number] => {
      const el = list[Math.max(0, Math.min(q.i, list.length - 1))];
      if (!el) return [ed, 0];
      let left = q.off;
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let t: Node | null;
      while ((t = walker.nextNode())) {
        const len = (t.nodeValue ?? '').length;
        if (left <= len) return [t, left];
        left -= len;
      }
      return [el, el.childNodes.length && (el.lastChild as Element)?.tagName === 'BR' ? el.childNodes.length - 1 : el.childNodes.length];
    };
    const [n1, o1] = at(p), [n2, o2] = at(p2);
    const s = getSelection();
    if (!s) return;
    const r = document.createRange();
    r.setStart(n1, o1);
    r.setEnd(n2, o2);
    s.removeAllRanges();
    s.addRange(r);
  }

  /** перерисовать поле из строк, вернуть курсор, сообщить наверх */
  function set(blocks: Block[], a?: Pos, b?: Pos) {
    ed.innerHTML = blocksHtml(blocks.length ? blocks : [{ t: 'h', text: '' }]);
    if (a) place(a, b ?? a);
    changed();
  }
  function changed() {
    ed.classList.toggle('is-empty', empty());
    syncBar();
    o.onChange(read());
  }

  // ---------- ввод ----------
  ed.addEventListener('beforeinput', (e) => {
    const t = e.inputType;
    if (t === 'insertParagraph' || t === 'insertLineBreak') {
      e.preventDefault();
      const sel = selection();
      if (!sel) return;
      let blocks = read();
      // выделение — сначала убрать его
      if (sel.a.i !== sel.b.i || sel.a.off !== sel.b.off) blocks = cut(blocks, sel.a, sel.b);
      const { i, off } = sel.a;
      const cur = blocks[i];
      // Enter в пустом пункте — выход из списка (как в Заметках)
      if (cur.t === 'li' && !cur.text.trim()) { cur.t = 'p'; set(blocks, { i, off: 0 }); return; }
      const next: Block = { t: cur.t === 'li' ? 'li' : 'p', text: cur.text.slice(off) };
      cur.text = cur.text.slice(0, off);
      blocks.splice(i + 1, 0, next);
      set(blocks, { i: i + 1, off: 0 });
      return;
    }
    if (t === 'deleteContentBackward') {
      const sel = selection();
      if (!sel || sel.a.i !== sel.b.i || sel.a.off !== sel.b.off || sel.a.off !== 0) return;
      e.preventDefault();
      const blocks = read();
      const { i } = sel.a;
      // Backspace в начале пункта снимает точку; в начале строки — склейка с предыдущей
      if (blocks[i].t === 'li') { blocks[i].t = 'p'; set(blocks, { i, off: 0 }); return; }
      if (i === 0) return;
      const prev = blocks[i - 1];
      const off = prev.text.length;
      prev.text += blocks[i].text;
      blocks.splice(i, 1);
      set(blocks, { i: i - 1, off });
      return;
    }
    if (t === 'insertFromPaste' || t === 'insertFromDrop') return; // своя вставка ниже
  });

  ed.addEventListener('input', () => {
    // стёрли всё — поле снова начинается с заголовка, как новая заметка
    if (empty()) {
      const bs = read();
      if (bs.length !== 1 || bs[0].t !== 'h' || !valid()) { set([{ t: 'h', text: '' }], { i: 0, off: 0 }); return; }
    }
    if (!valid()) {
      const sel = selection();
      set(domToBlocks(ed), sel?.a, sel?.b);
      return;
    }
    // «- » или «— » в начале строки — пункт списка (как в Заметках)
    const sel = selection();
    if (sel && sel.a.i === sel.b.i) {
      const blocks = read();
      const b = blocks[sel.a.i];
      const m = b && b.t === 'p' ? /^[-—–*•][\s ]/.exec(b.text) : null;
      if (m) { b.t = 'li'; b.text = b.text.slice(m[0].length); set(blocks, { i: sel.a.i, off: Math.max(0, sel.a.off - m[0].length) }); return; }
    }
    changed();
  });

  /** вырезать текст между двумя позициями */
  function cut(blocks: Block[], a: Pos, b: Pos): Block[] {
    const first = blocks[a.i], last = blocks[b.i];
    first.text = first.text.slice(0, a.off) + last.text.slice(b.off);
    blocks.splice(a.i + 1, b.i - a.i);
    return blocks;
  }

  // ---------- вставка ----------
  ed.addEventListener('paste', (e) => {
    const cd = e.clipboardData;
    if (!cd) return;
    e.preventDefault();
    const html = cd.getData('text/html');
    const plain = cd.getData('text/plain');
    let pasted: Block[] = [];
    let guessed = 0;
    if (html) {
      pasted = domToBlocks(new DOMParser().parseFromString(html, 'text/html').body, true);
      // короткая строка без точки отдельным абзацем — заголовок раздела
      pasted.forEach((x, k) => { if (x.t === 'p' && looksLikeHeading(x.text, pasted[k + 1])) x.t = 'h'; });
      guessed = pasted.filter((x) => x.t === 'h').length;
    }
    if (!pasted.length) ({ blocks: pasted, guessed } = plainToBlocks(plain));
    if (!pasted.length) return;
    const sel = selection();
    const before = read();
    let blocks = read();
    const at: Pos = sel?.a ?? { i: blocks.length - 1, off: blocks[blocks.length - 1]?.text.length ?? 0 };
    if (sel && (sel.a.i !== sel.b.i || sel.a.off !== sel.b.off)) blocks = cut(blocks, sel.a, sel.b);
    // одна строка текста — просто текст в позицию курсора
    if (pasted.length === 1 && pasted[0].t === 'p') {
      const cur = blocks[at.i];
      cur.text = cur.text.slice(0, at.off) + pasted[0].text + cur.text.slice(at.off);
      set(blocks, { i: at.i, off: at.off + pasted[0].text.length });
      return;
    }
    const cur = blocks[at.i];
    const left: Block = { t: cur.t, text: cur.text.slice(0, at.off) };
    const right: Block = { t: cur.t === 'h' ? 'p' : cur.t, text: cur.text.slice(at.off) };
    // в пустую строку текст встаёт целиком, со своими заголовками
    const parts = [...(left.text.trim() ? [left] : []), ...pasted, ...(right.text.trim() ? [right] : [])];
    blocks.splice(at.i, 1, ...parts);
    const end = at.i + (left.text.trim() ? 1 : 0) + pasted.length - 1;
    set(blocks, { i: end, off: blocks[end].text.length });
    undoable({
      text: guessed ? 'Текст вставлен, заголовки расставлены' : 'Текст вставлен с абзацами и списками',
      undo: () => { set(before, { i: Math.min(before.length - 1, (sel?.a.i ?? 0)), off: sel?.a.off ?? 0 }); },
      run: () => {},
    });
  });

  // ---------- капсула «Aa» и «Список» ----------
  bar.innerHTML = `
    <div class="c-notes-bar__styles" role="group" aria-label="Стиль строки" hidden>
      <button type="button" data-style="h" class="c-notes-bar__h">Заголовок</button>
      <button type="button" data-style="p">Текст</button>
      <button type="button" data-style="li">${LIST_ICON}Пункт</button>
    </div>
    <div class="c-notes-bar__main">
      <button type="button" data-aa aria-expanded="false" aria-label="Стиль строки">Aa</button>
      <button type="button" data-list aria-pressed="false" aria-label="Список">${LIST_ICON}</button>
    </div>`;
  const styles = bar.querySelector<HTMLElement>('.c-notes-bar__styles')!;
  const aa = bar.querySelector<HTMLElement>('[data-aa]')!;
  const listBtn = bar.querySelector<HTMLElement>('[data-list]')!;
  let lastSel: { a: Pos; b: Pos } | null = null;

  /** у всех выделенных строк — этот стиль */
  function setKind(kind: BlockKind | 'toggle-li') {
    const sel = selection() ?? lastSel;
    if (!sel) return;
    const blocks = read();
    const range = blocks.slice(sel.a.i, sel.b.i + 1);
    const k: BlockKind = kind === 'toggle-li' ? (range.every((x) => x.t === 'li') ? 'p' : 'li') : kind;
    range.forEach((x) => (x.t = k));
    set(blocks, sel.a, sel.b);
  }
  function syncBar() {
    const sel = selection();
    if (sel) lastSel = sel;
    const s = sel ?? lastSel;
    const kinds = s ? read().slice(s.a.i, s.b.i + 1).map((x) => x.t) : [];
    const one = kinds.length && kinds.every((x) => x === kinds[0]) ? kinds[0] : null;
    listBtn.setAttribute('aria-pressed', String(one === 'li'));
    styles.querySelectorAll<HTMLElement>('[data-style]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.style === one)));
  }
  const showStyles = (on: boolean) => { styles.hidden = !on; aa.setAttribute('aria-expanded', String(on)); };

  // нажатие по капсуле не уводит фокус из поля: клавиатура остаётся, курсор на месте
  bar.addEventListener('pointerdown', (e) => { if ((e.target as Element).closest('button')) e.preventDefault(); });
  bar.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLElement>('button');
    if (!b) return;
    if (b.hasAttribute('data-aa')) { showStyles(styles.hidden); syncBar(); return; }
    if (b.hasAttribute('data-list')) { setKind('toggle-li'); return; }
    if (b.dataset.style) { setKind(b.dataset.style as BlockKind); showStyles(false); }
    if (document.activeElement !== ed) ed.focus();
  });
  document.addEventListener('selectionchange', () => { if (document.activeElement === ed) syncBar(); });

  // на телефоне капсула стоит над клавиатурой: visualViewport знает её высоту
  const touch = matchMedia('(max-width: 1023px), (pointer: coarse)');
  const vv = window.visualViewport;
  const place2 = () => {
    if (!vv) return;
    const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    bar.style.setProperty('--kb', `${kb}px`);
  };
  vv?.addEventListener('resize', place2);
  vv?.addEventListener('scroll', place2);
  // пока пишут — нижнего меню нет, как внутри заметки (Никита 05.11:
  // капсула находила на меню); вышли из поля — меню вернулось
  const writing = (on: boolean) => document.documentElement.classList.toggle('is-writing', on);
  ed.addEventListener('focus', () => { bar.classList.add('is-on'); writing(true); place2(); syncBar(); });
  ed.addEventListener('blur', () => {
    // на ПК капсула стоит над полем всегда; на телефоне уходит вместе с клавиатурой
    if (touch.matches) { bar.classList.remove('is-on'); showStyles(false); }
    writing(false);
  });
  document.addEventListener('astro:before-swap', () => writing(false), { once: true });
  ed.classList.toggle('is-empty', empty());
  return { read };
}
