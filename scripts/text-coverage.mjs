// Сверка: какие предложения исходников не легли в данные карточки.
// node scripts/text-coverage.mjs  → сводка в консоль, детали в research/text-coverage.md (CHARACTER.md, 08.10.2026)
// Предложение «не легло», если меньше 60 % его слов (по основам) есть в данных карточки.
// Шум ожидаем: меню, навигация и отзывы с сайтов — отбирать глазами.
import { readFileSync, readdirSync, existsSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const repo = process.argv[2] ?? '.';
const R = (...p) => join(repo, ...p);
const stem = (w) => w.slice(0, 5);
const words = (t) => (t.toLowerCase().match(/[а-яё]{5,}/g) || []).map(stem);

// все строки объекта, кроме путей к файлам
function strings(v, out = []) {
  if (typeof v === 'string') { if (!v.startsWith('/')) out.push(v); }
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => strings(x, out));
  return out;
}

function sentences(text) {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/\r/g, '')
    .replace(/\n(?!\n|\s*[-•*#|])/g, ' ') // перенос внутри абзаца: реестр режет фразы по строкам
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((s) => s.replace(/^[\s\-•*#>|]+/, '').trim())
    .filter((s) => words(s).length >= 4);
}

function audit(name, sources, target) {
  const have = new Set(words(strings(target).join(' ')));
  let total = 0, hit = 0;
  const missing = [];
  for (const [label, text] of sources) {
    for (const s of sentences(text)) {
      const w = words(s);
      const h = w.filter((x) => have.has(x)).length;
      total += w.length; hit += h;
      if (h / w.length < 0.6) missing.push(`[${label}] ${s}`);
    }
  }
  return { name, pct: total ? Math.round((100 * hit) / total) : null, missing };
}

// текст из notes.md: разделы с присланным текстом; иначе файл целиком
function notesText(p) {
  if (!existsSync(p)) return '';
  const t = readFileSync(p, 'utf8');
  const parts = t.split(/\n(?=##\s)/);
  const pick = parts.filter((s) => /^##\s.*(текст|о себе|дословно|описание|о нас|обо мне|из сообщения|условия|программ|меню|цены|тариф)/i.test(s));
  return (pick.length ? pick : parts).join('\n');
}

const report = [];

// ---------- подрядчики ----------
const specJson = {};
for (const cat of readdirSync(R('src/data/specialists'))) {
  if (!statSync(R('src/data/specialists', cat)).isDirectory()) continue;
  for (const f of readdirSync(R('src/data/specialists', cat))) {
    if (f.endsWith('.json')) specJson[f.replace('.json', '')] = JSON.parse(readFileSync(R('src/data/specialists', cat, f), 'utf8'));
  }
}
for (const slug of readdirSync(R('research/specialists'))) {
  const dir = R('research/specialists', slug);
  if (!statSync(dir).isDirectory() || !specJson[slug]) continue;
  const src = [['notes', notesText(join(dir, 'notes.md'))]];
  for (const f of readdirSync(dir)) {
    if (/\.(txt)$/.test(f) && !/list|ok|unique|videos/.test(f)) src.push([f, readFileSync(join(dir, f), 'utf8')]);
    if (f === 'site.md' || f === 'pdf.md') src.push([f, readFileSync(join(dir, f), 'utf8')]);
  }
  report.push({ kind: 'подрядчик', ...audit(slug, src, specJson[slug]) });
}

// ---------- площадки ----------
for (const slug of readdirSync(R('research'))) {
  const dir = R('research', slug);
  const jp = R('src/data/venues', `${slug}.json`);
  if (!statSync(dir).isDirectory() || !existsSync(jp)) continue;
  const src = [];
  if (existsSync(join(dir, 'notes.md'))) src.push(['notes', readFileSync(join(dir, 'notes.md'), 'utf8')]);
  if (existsSync(join(dir, 'site'))) for (const f of readdirSync(join(dir, 'site'))) if (f.endsWith('.md')) src.push([`site/${f}`, readFileSync(join(dir, 'site', f), 'utf8')]);
  report.push({ kind: 'площадка', ...audit(slug, src, JSON.parse(readFileSync(jp, 'utf8'))) });
}

report.sort((a, b) => (a.pct ?? 999) - (b.pct ?? 999));
for (const r of report) console.log(`${r.kind.padEnd(10)} ${r.name.padEnd(16)} ${String(r.pct ?? '—').padStart(4)}%  не легло предложений: ${r.missing.length}`);
writeFileSync(R('research', 'text-coverage.md'), report.map((r) => `## ${r.kind} ${r.name} — ${r.pct}%\n\n${r.missing.map((m) => `- ${m}`).join('\n')}\n`).join('\n'));
