// Сторож реестра: читает Google-таблицу модератора и говорит, кто в ней есть,
// а на сайте ещё нет. Ничего не верстает — вёрстка это конвейер
// specialist-page / venue-page, там нужны решения (отбор кадров, текст).
//
//   node scripts/registry-watch.mjs           — коротко: только новые и готовые
//   node scripts/registry-watch.mjs --all     — плюс черновики и чего им не хватает
//   node scripts/registry-watch.mjs --json    — машинный вывод
//   node scripts/registry-watch.mjs --hook    — для SessionStart-хука: JSON и только
//     когда есть о чём сказать; --stale N пропускает проверку, если она уже была
//     меньше N часов назад (отметка в .claude/.registry-watch-stamp).
//
// Таблица открыта по ссылке, поэтому читается без авторизации через gviz-CSV
// (по одной вкладке за раз). Сменился файл — правится SHEET_ID.
import { readFileSync, readdirSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SHEET_ID = '1J8U7oLfBSenFn7VKWL7gp1EfNfH8lFCV3THmpH8eiA8';
const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

/** вкладка → папка категории в src/data/specialists */
const CATEGORY_TABS = {
  'Организаторы': 'organizatory',
  'Координаторы': 'koordinatory',
  'Ведущие': 'vedushchie',
  'Декораторы': 'dekoratory',
  'Фотографы': 'fotografy',
  'Видеографы': 'videografy',
  'Reels-мейкеры': 'rils-meikery',
  'Кейтеринг': 'keitering',
  'Кондитеры': 'konditery',
  'Стилисты и визажисты': 'stilisty',
  'Диджеи': 'dj',
  'Кавер-группы': 'kaver-gruppy',
  'Вокалисты': 'vokalisty',
  'Музыканты': 'muzykanty',
  'Спецэффекты': 'speceffekty',
  'Аренда звука': 'arenda-zvuka',
  'Аренда светомузыки': 'arenda-sveta',
  'Хореографы': 'horeografy',
  'Аниматоры': 'animatory',
  'Шоу': 'shou',
  'Фокусники и иллюзионисты': 'fokusniki',
  'Авто и трансфер': 'avto',
};

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch !== '\r') field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

async function fetchTab(title) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(title)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${title}: HTTP ${res.status}`);
  const rows = parseCsv(await res.text());
  // gviz сам решает, сколько строк шапки съесть, и делает это по-разному от
  // вкладки к вкладке: где-то отдаёт три строки как есть (группы / ключи /
  // подписи), где-то склеивает их в одну — «Основное status Статус».
  // Поэтому ищем строку ключей, а не надеемся на её номер.
  const isKeyRow = (row) => {
    const filled = row.filter(Boolean);
    return filled.length > 3 && filled.every((c) => /^[A-Za-z][A-Za-z0-9_]*$/.test(c));
  };
  let keys, dataStart;
  const i = rows.slice(0, 3).findIndex(isKeyRow);
  if (i >= 0) { keys = rows[i]; dataStart = i + 2; }            // ниже строка подписей
  else { keys = (rows[0] ?? []).map((c) => (c.match(/\b[A-Za-z][A-Za-z0-9_]*\b/) ?? [''])[0]); dataStart = 1; }
  return rows.slice(dataStart)
    .map((cells) => Object.fromEntries(keys.map((k, i) => [k, (cells[i] ?? '').trim()])))
    .filter((r) => (r.name ?? '').trim());
}

/** кто уже на сайте: JSON-карточки + «Лешаковы» из TS */
function onSite() {
  const dir = join(ROOT, 'src/data/specialists');
  const names = new Set(['Юлия и Леонид Лешаковы']);
  const slugs = new Set(['leshakovy']);
  if (existsSync(dir)) {
    for (const cat of readdirSync(dir, { withFileTypes: true })) {
      if (!cat.isDirectory()) continue;   // рядом лежит README.md
      const catDir = join(dir, cat.name);
      for (const f of readdirSync(catDir).filter((f) => f.endsWith('.json'))) {
        const s = JSON.parse(readFileSync(join(catDir, f), 'utf8'));
        names.add(s.name.trim()); slugs.add(s.slug);
      }
    }
  }
  return { names, slugs };
}

/** Чего не хватает. Без фото карточку не собрать вообще — это блокер;
 *  текст и контакты можно добить у подрядчика по ходу, поэтому они заметки. */
function gapsOf(row) {
  const blockers = [];
  const notes = [];
  if (!row.materials) blockers.push('портфолио');
  if (!row.bio) notes.push('текст о себе');
  if (!row.tagline) notes.push('бирка');
  if (!row.phone && !row.social && !row.site) notes.push('контакты');
  return { blockers, notes };
}

const args = process.argv.slice(2);

// --stale N: не дёргать таблицу, если проверяли меньше N часов назад
const staleIdx = args.indexOf('--stale');
const STAMP = join(ROOT, '.claude/.registry-watch-stamp');
if (staleIdx >= 0) {
  const hours = Number(args[staleIdx + 1]) || 6;
  if (existsSync(STAMP) && Date.now() - statSync(STAMP).mtimeMs < hours * 3600e3) process.exit(0);
  try { writeFileSync(STAMP, new Date().toISOString()); } catch {}
}

const site = onSite();
const found = [];

for (const [tab, categorySlug] of Object.entries(CATEGORY_TABS)) {
  let rows;
  try { rows = await fetchTab(tab); } catch (e) { console.error(`! ${e.message}`); continue; }
  for (const row of rows) {
    const name = row.name.trim();
    if (site.names.has(name) || (row.slug && site.slugs.has(row.slug))) continue;
    found.push({ tab, categorySlug, name, status: row.status || 'без статуса', ...gapsOf(row), materials: row.materials || '' });
  }
}

if (args.includes('--hook')) {
  // Хук молчит, когда сказать нечего: пустой вывод — ничего не показывается
  const ready = found.filter((f) => !f.blockers.length);
  if (found.length) {
    const lines = ready.map((f) => `${f.name} (${f.tab}) — материалы есть`);
    const rest = found.length - ready.length;
    if (rest) lines.push(`ещё ${rest} без фото`);
    console.log(JSON.stringify({
      systemMessage: `Реестр каталога: новых подрядчиков — ${found.length}. ${lines.join('; ')}`,
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: `В Google-таблице реестра есть подрядчики, которых нет на сайте:\n` +
          found.map((f) => `- ${f.name} (${f.tab}, ${f.status})` +
            (f.blockers.length ? `, не хватает: ${[...f.blockers, ...f.notes].join(', ')}` : `, материалы: ${f.materials}`)).join('\n') +
          `\nЗаводятся скиллом specialist-page. Полный список: node scripts/registry-watch.mjs --all`,
      },
    }));
  }
} else if (args.includes('--json')) {
  console.log(JSON.stringify(found, null, 2));
} else if (!found.length) {
  console.log('Реестр: новых подрядчиков нет.');
} else {
  const ready = found.filter((f) => !f.blockers.length);
  const partial = found.filter((f) => f.blockers.length);
  console.log(`Реестр: новых в таблице — ${found.length}, с материалами — ${ready.length}.`);
  for (const f of ready) {
    const note = f.notes.length ? ` · спросить: ${f.notes.join(', ')}` : '';
    console.log(`  ✓ ${f.name} (${f.tab}, ${f.status}) — ${f.materials}${note}`);
  }
  if (args.includes('--all')) {
    for (const f of partial) console.log(`  · ${f.name} (${f.tab}, ${f.status}) — нет: ${[...f.blockers, ...f.notes].join(', ')}`);
  } else if (partial.length) {
    console.log(`  · ещё ${partial.length} без фото — подробности: node scripts/registry-watch.mjs --all`);
  }
}
