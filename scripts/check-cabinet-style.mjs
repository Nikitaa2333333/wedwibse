#!/usr/bin/env node
// СТРАЖ СТИЛЕЙ КАБИНЕТА: node scripts/check-cabinet-style.mjs
// Кабинет и админка — не сайт (CLAUDE.md). Скрипт падает (код 1), если в их
// файлах появилось то, из-за чего дизайн уже расползался (аудит 05.11.2026):
//   • цвет литералом (#hex, rgb(), hsl()) — только токены из components/admin/base.css;
//   • токены витрины (--paper, --ink, --bg, --surface, --accent, --font-serif…);
//   • классы реестра витрины в разметке (.pill, .chip, .sheet, .theme-dark, .hero-btn);
//   • капс (text-transform: uppercase).
// Превью «как будет на сайте» законно в оформлении витрины — такой кусок
// обрамляется метками  site-preview:start  …  site-preview:end  в комментарии
// (или одна строка — комментарий  site-preview  в конце этой строки).
// Экраны входа (vhod, registraciya, parol) — в стиле сайта по решению
// владельца (31.10), они живут вне этих папок и не проверяются.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOTS = ['src/components/admin', 'src/pages/profi/moi', 'src/pages/profi/admin', 'src/lib/cab-ui.ts'];
const SKIP = new Set(['src/components/admin/base.css']); // здесь цвета и живут
const EXT = /\.(css|astro|ts)$/;

const RULES = [
  { re: /#[0-9a-fA-F]{3,8}\b/g, msg: 'цвет литералом — нужен токен в components/admin/base.css' },
  { re: /\b(?:rgba?|hsla?)\(/g, msg: 'цвет литералом — нужен токен в components/admin/base.css' },
  { re: /var\(--(?:paper|ink|bg|fg|surface|surface-dim|accent|mark|font-serif)\)/g, msg: 'токен витрины в кабинете' },
  // класс целым словом: c-sheet-area и a-pill — свои классы кабинета, не витрина
  { re: /class(?:=|:list=)["'{][^"'}]*(?<![\w-])(?:pill|chip|sheet|theme-dark|hero-btn)(?![\w-])/g, msg: 'класс реестра витрины в кабинете' },
  { re: /text-transform:\s*uppercase/g, msg: 'капс запрещён' },
];

function files(p) {
  if (!statSync(p, { throwIfNoEntry: false })) return [];
  if (statSync(p).isFile()) return [p];
  return readdirSync(p).flatMap((n) => files(join(p, n)));
}

// убираем комментарии (длина строк сохраняется — номера строк верные)
const blank = (m) => m.replace(/[^\n]/g, ' ');
function strip(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => (/site-preview/.test(m) ? m : blank(m)))
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/(^|[^:'"`])\/\/[^\n]*/g, (m, p) => p + blank(m.slice(p.length)));
}

let bad = 0;
for (const f of ROOTS.flatMap(files).filter((f) => EXT.test(f))) {
  const rel = relative('.', f).replaceAll('\\', '/');
  if (SKIP.has(rel)) continue;
  const lines = strip(readFileSync(f, 'utf8')).split('\n');
  let preview = false;
  lines.forEach((line, i) => {
    if (/site-preview:start/.test(line)) preview = true;
    if (/site-preview:end/.test(line)) { preview = false; return; }
    if (preview || /site-preview(?!:)/.test(line)) return; // метка на самой строке
    for (const { re, msg } of RULES) {
      re.lastIndex = 0;
      if (re.test(line)) { bad++; console.log(`${rel}:${i + 1}  ${msg}\n    ${line.trim().slice(0, 140)}`); }
    }
  });
}
if (bad) { console.log(`\nНарушений: ${bad}. Правила — .claude/skills/cabinet-ui/SKILL.md`); process.exit(1); }
console.log('Стили кабинета чистые.');
