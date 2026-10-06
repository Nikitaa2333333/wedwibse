// Сверка реестра с сайтом: что в Google-таблице модератора НЕ совпадает
// с тем, что стоит на сайте. registry-watch отвечает «кто новый», этот
// скрипт — «что поменяли у тех, кто уже есть» и «что сломано в ссылках».
//
//   node scripts/registry-diff.mjs           — человеку, по группам
//   node scripts/registry-diff.mjs --json    — машинный вывод (ночная проверка)
//
// Появился 06.10.2026: до него «посмотри изменения в таблице» означало
// скачать xlsx и сравнить со вчерашней копией глазами — и правка цены
// у «Отражения», внесённая раньше вчерашней выгрузки, такой разницы
// не давала вовсе. Здесь сравнение не с копией, а с самим сайтом.
//
// Что сверяется:
//  • подрядчики — цена «от», опыт, возраст и все столбцы, совпадающие
//    с ключами фильтров категории (стиль, форматы, свой диджей…): подписи
//    из таблицы переводятся в значения через FILTERS_BY_CATEGORY;
//  • площадки — чек, вместимость (лента feed.ts) и есть ли на странице
//    аренда / депозит / сервисный сбор из таблицы;
//  • снятые: карточка на сайте есть, строки в таблице нет;
//  • ссылки: диск, который не открывается (обрезанная ссылка — 404),
//    и Яндекс.Карты на ДОМ вместо организации (у дома нет отзывов).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, CATEGORY_TABS, fetchTab, norm, sameName } from './registry-lib.mjs';

const { FILTERS_BY_CATEGORY } = await import('../src/data/specialist-filters.ts');
const { FEED } = await import('../src/data/feed.ts');

const num = (v) => {
  const digits = String(v ?? '').replace(/[^\d.,]/g, '').replace(',', '.');
  if (!/\d/.test(digits)) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
};
const fmt = (n) => n == null ? '—' : Math.round(n).toLocaleString('ru-RU').replace(/ /g, ' ');
const yes = (v) => /^да$/i.test(String(v).trim()) ? 'yes' : /^нет$/i.test(String(v).trim()) ? 'no' : null;
const AGE = { 'до 25': 'до 25', '25–35': '25–35', '35–50': '35–50', '50+': '50+' };

// ============ ЧТО НА САЙТЕ ============
function specialistsOnSite() {
  const out = [];
  const dir = join(ROOT, 'src/data/specialists');
  for (const cat of readdirSync(dir, { withFileTypes: true })) {
    if (!cat.isDirectory()) continue;
    for (const f of readdirSync(join(dir, cat.name)).filter((f) => f.endsWith('.json'))) {
      out.push(JSON.parse(readFileSync(join(dir, cat.name, f), 'utf8')));
    }
  }
  // Лешаковы живут в specialists.ts, не в JSON — сверяем по тем полям, что знаем
  out.push({ slug: 'leshakovy', categorySlug: 'fotografy', name: 'Юлия и Леонид Лешаковы', ts: true });
  return out;
}

const issues = { changed: [], removed: [], links: [], unmatched: [] };
const push = (kind, who, what) => issues[kind].push({ who, what });

// ============ ССЫЛКИ ============
const diskCache = new Map();
async function diskOk(url) {
  if (diskCache.has(url)) return diskCache.get(url);
  let ok = null;
  try {
    const r = await fetch(`https://cloud-api.yandex.net/v1/disk/public/resources?public_key=${encodeURIComponent(url)}&limit=1`, { signal: AbortSignal.timeout(20000) });
    ok = r.status === 404 ? false : r.ok ? true : null;
  } catch {}
  diskCache.set(url, ok);
  return ok;
}
async function checkLinks(who, row) {
  for (const url of String(row.materials ?? '').match(/https?:\/\/disk\.yandex\.ru\/[da]\/[\w-]+/g) ?? []) {
    if ((await diskOk(url)) === false) push('links', who, `диск не открывается (404) — ссылка обрезана или закрыта: ${url}`);
  }
  if (/yandex\.ru\/maps\/.*\/house\//.test(row.mapsUrl ?? '')) {
    push('links', who, 'Яндекс.Карты ведут на ДОМ, а не на организацию — у дома нет отзывов и рейтинга');
  }
}

// ============ ПОДРЯДЧИКИ ============
const site = specialistsOnSite();
const seen = new Set();

for (const [tab, cat] of Object.entries(CATEGORY_TABS)) {
  let rows;
  try { rows = await fetchTab(tab); } catch (e) { console.error(`! ${tab}: ${e.message}`); continue; }
  const groups = Object.fromEntries((FILTERS_BY_CATEGORY[cat] ?? []).map((g) => [g.key, g]));
  for (const row of rows) {
    const who = `${row.name.trim()} (${tab})`;
    await checkLinks(who, row);
    const s = site.find((x) => (row.slug && x.slug === row.slug) || (sameName(x.name, row.name) && (x.categorySlug === cat || (x.alsoCategories ?? []).includes(cat))))
      ?? site.find((x) => (row.slug && x.slug === row.slug) || sameName(x.name, row.name));
    if (!s) { push('unmatched', who, `нет на сайте${row.materials ? '' : ' (и нет материалов)'}`); continue; }
    seen.add(s.slug);
    if (s.ts || (s.categorySlug !== cat && (s.alsoCategories ?? []).includes(cat))) continue; // вторая вкладка той же карточки

    const p = num(row.priceFrom);
    if (p != null && p !== (s.priceFrom ?? null)) push('changed', who, `цена от: в таблице ${fmt(p)} ₽, на сайте ${s.priceFrom ? fmt(s.priceFrom) + ' ₽' : 'не указана'}`);
    const e = num(row.experienceYears);
    if (e != null && e !== (s.experienceYears ?? null)) push('changed', who, `опыт: в таблице ${e}, на сайте ${s.experienceYears ?? '—'}`);
    if (row.age && AGE[row.age.trim()] && AGE[row.age.trim()] !== s.age) push('changed', who, `возраст: в таблице ${row.age}, на сайте ${s.age ?? '—'}`);

    for (const [key, g] of Object.entries(groups)) {
      if (['city', 'gender', 'age', 'experience', 'price', 'languages'].includes(key)) continue;
      const raw = (row[key] ?? '').trim();
      if (!raw) continue;
      let want;
      if (g.options.every((o) => ['yes', 'no'].includes(o.value))) want = yes(raw);
      else {
        const labels = raw.split(/\s*,\s*/);
        const vals = labels.map((l) => g.options.find((o) => norm(o.label) === norm(l))?.value).filter(Boolean);
        if (!vals.length) continue;
        want = g.type === 'single' ? vals[0] : vals;
      }
      if (want == null) continue;
      const have = s.filters?.[key];
      const a = [want].flat().map(String).sort().join(','), b = [have ?? []].flat().map(String).sort().join(',');
      if (a !== b) {
        const label = (v) => [v ?? []].flat().map((x) => g.options.find((o) => o.value === x)?.label ?? x).join(', ') || '—';
        push('changed', who, `${g.label.toLowerCase()}: в таблице «${label(want)}», на сайте «${label(have)}»`);
      }
    }
  }
}
for (const s of site) {
  if (!seen.has(s.slug)) push('removed', `${s.name} (${s.categorySlug})`, 'на сайте есть, в таблице строки нет — сняли?');
}

// ============ ПЛОЩАДКИ ============
try {
  const venues = await fetchTab('Площадки');
  const vdir = join(ROOT, 'src/data/venues');
  for (const row of venues) {
    const who = `${row.name.trim()} (Площадки)`;
    await checkLinks(who, row);
    const feed = FEED.find((f) => f.kind === 'venue' && ((row.slug && f.slug === row.slug) || sameName(f.name, row.name)));
    if (!feed) { push('unmatched', who, 'нет на сайте'); continue; }
    const check = num(row.checkFrom);
    if (check != null && check !== (feed.checkFrom ?? null)) push('changed', who, `чек от: в таблице ${fmt(check)} ₽, на сайте ${feed.checkFrom ? fmt(feed.checkFrom) + ' ₽' : 'не указан'}`);
    const cap = num(row.capacityBanquet);
    if (cap != null && cap > feed.capacityMax) push('changed', who, `банкет: в таблице до ${cap}, в каталоге до ${feed.capacityMax}`);
    // Аренда, депозит и сервис живут текстом в блоках страницы — ищем число на странице
    const file = join(vdir, `${feed.slug}.json`);
    const page = existsSync(file) ? readFileSync(file, 'utf8').replace(/ /g, ' ') : '';
    if (page) {
      for (const [k, label, unit] of [['rentFrom', 'аренда от', ' ₽'], ['depositFrom', 'депозит от', ' ₽'], ['serviceFee', 'сервисный сбор', ' %']]) {
        const v = num(row[k]);
        if (v != null && !page.includes(fmt(v))) push('changed', who, `${label} ${fmt(v)}${unit} — в таблице есть, на странице такого числа нет`);
      }
    }
  }
} catch (e) { console.error(`! Площадки: ${e.message}`); }

// ============ ВЫВОД ============
if (process.argv.includes('--json')) {
  console.log(JSON.stringify(issues, null, 2));
} else {
  const total = issues.changed.length + issues.removed.length + issues.links.length;
  if (!total && !issues.unmatched.length) console.log('Реестр и сайт сходятся.');
  const section = (title, list) => {
    if (!list.length) return;
    console.log(`\n${title} (${list.length}):`);
    const by = new Map();
    for (const i of list) by.set(i.who, [...(by.get(i.who) ?? []), i.what]);
    for (const [who, whats] of by) {
      console.log(`  ${who}`);
      for (const w of whats) console.log(`    · ${w}`);
    }
  };
  section('Разошлось с сайтом', issues.changed);
  section('Ссылки', issues.links);
  section('Сняты из таблицы', issues.removed);
  section('Нет на сайте', issues.unmatched);
}
