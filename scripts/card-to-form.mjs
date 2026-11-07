// Наша карточка подрядчика → анкета кабинета (пилот, STAGE2.md, 03.11):
//   node scripts/card-to-form.mjs                 — сухой прогон по всем 19: что получится, сверка текста и фильтров
//   node scripts/card-to-form.mjs <slug> …        — только эти
//   node scripts/card-to-form.mjs --write [slug…] — записать анкету (поле form) в карточки базы
// Доступ — PB_URL, PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD (.env); к серверу — через
// туннель bash scripts/pb-tunnel.sh. Писать в боевую базу — только после «выкладывай».
//
// Режим «карточку ведём мы» (решение Никиты 03.11, docs/cabinet/CABINET.md §24): визитку
// в нынешнем виде держим мы — JSON в git остаётся источником. Владелец сам
// меняет только цену, ответы на вопросы, контакты и видео; описание, фото,
// имя и аватар — просьбой «что поменять», правим руками. Поэтому анкета —
// не разбор всего оформления: текст в ней только для просмотра (сплющенный
// story), а поля, которые владелец правит, переносятся точно.
// Флаг `managed: true` в form — его читает хук (pb_hooks/lib/cabinet.js).
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = 'src/data/specialists';

/** раздел story → { title, body } в разметке анкеты: пустая строка — абзац, «— » — пункт */
function sectionOf(s) {
  const paras = [];
  const bullets = (list) => list.filter(Boolean).map((x) => `— ${x}`).join('\n');
  if (s.lead) paras.push(s.lead);
  for (const t of s.text ?? []) paras.push(t);
  if (s.tiles?.length) paras.push(bullets(s.tiles));
  if (s.stats?.length) paras.push(bullets(s.stats.map((x) => `${x.value} ${x.label}`)));
  if (s.list?.length) paras.push(bullets(s.list));
  if (s.items?.length) {
    paras.push(bullets(s.items.map((it) => [it.title, it.text, it.list?.length ? it.list.join('; ') : ''].filter(Boolean).join(' — '))));
  }
  if (s.tariffs?.length) {
    paras.push(bullets(s.tariffs.map((t) => {
      const head = [t.name, [t.price, t.unit].filter(Boolean).join(' ')].filter(Boolean).join(' — ');
      return [head, t.lead, t.includes?.length ? t.includes.join('; ') : '', t.note].filter(Boolean).join('. ');
    })));
  }
  for (const t of s.after ?? []) paras.push(t);
  return { title: s.title ?? '', body: paras.filter(Boolean).join('\n\n') };
}

/**
 * Карточка старого формата — без story (Лешаковы, 07.11: из-за этого им
 * не вышла анкета и ссылка): текст живёт в bio, offers, packageIncludes,
 * quote. Собираем из них разделы в том же порядке, что на визитке.
 */
function legacyStory(card) {
  const out = [];
  if (card.bio) out.push({ title: card.aboutTitle ?? 'О нас', text: String(card.bio).split(/\n\s*\n/) });
  if (card.offers?.length) out.push({ title: 'Почему мы', items: card.offers });
  if (card.packageIncludes?.length) out.push({ title: 'Что входит', list: card.packageIncludes });
  if (card.quote) out.push({ title: 'Стоимость', text: [card.quote] });
  return out;
}

const storyOf = (card) => (card.story?.length ? card.story : legacyStory(card));

/** JSON карточки конвейера → объект form той же формы, что пишет кабинет (lib/cabinet-form.ts) */
export function cardToForm(card) {
  const sections = storyOf(card).map(sectionOf).filter((x) => x.body);
  const price = Number(card.priceFrom) > 0 ? Number(card.priceFrom) : null;
  return {
    managed: true,
    // имя у наших карточек одной строкой («Михаил Галкин», «Push Decor»):
    // всё в «Имя», как у студии, — визитка и каталог берут name целиком
    firstName: card.name,
    lastName: '',
    name: card.name,
    tagline: card.tagline ?? '',
    sections,
    filters: card.filters ?? {},
    priceMode: price ? 'one' : 'request',
    priceFrom: price ?? '',
    priceNote: card.priceNote ?? '',
    tariffs: [],
    videos: [],
    // в наших JSON контактов нет: телефон владелец впишет сам, без него
    // анкета на проверку не уходит (submitProblems)
    contacts: {},
  };
}

// ---------- сверка ----------
const words = (s) => String(s ?? '').toLowerCase().replace(/ё/g, 'е').match(/[a-zа-я0-9]{3,}/g) ?? [];

/** все строки story — то, что должно доехать до анкеты */
function storyStrings(card) {
  const out = [];
  const walk = (v) => {
    if (typeof v === 'string') out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (k !== 'photo' && k !== 'kind' && k !== 'dark') walk(x);
  };
  walk(storyOf(card));
  return out;
}

export function coverage(card, form) {
  const src = words(storyStrings(card).join(' '));
  const have = new Set(words(form.sections.map((x) => `${x.title} ${x.body}`).join(' ')));
  const lost = src.filter((w) => !have.has(w));
  return { pct: src.length ? Math.round(((src.length - lost.length) / src.length) * 1000) / 10 : 100, lost: [...new Set(lost)].slice(0, 10) };
}

/** значения фильтров, которых нет в наборе категории (specialist-filters.ts) */
export function badFilters(card, groups) {
  const bad = [];
  for (const [key, v] of Object.entries(card.filters ?? {})) {
    const g = groups?.find((x) => x.key === key);
    if (!g) { bad.push(`${key}: нет такого вопроса`); continue; }
    for (const x of [].concat(v)) if (!g.options.some((o) => o.value === x)) bad.push(`${key}=${x}`);
  }
  return bad;
}

export async function loadCards() {
  const cards = [];
  for (const cat of await readdir(ROOT)) {
    if (!(await stat(join(ROOT, cat))).isDirectory()) continue;
    for (const f of await readdir(join(ROOT, cat))) {
      if (f.endsWith('.json')) cards.push(JSON.parse(await readFile(join(ROOT, cat, f), 'utf8')));
    }
  }
  return cards;
}

// ---------- запуск из командной строки ----------
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argv = process.argv.slice(2);
  const write = argv.includes('--write');
  const only = argv.filter((a) => !a.startsWith('--'));
  const { FILTERS_BY_CATEGORY } = await import('../src/data/specialist-filters.ts');
  const cards = (await loadCards()).filter((c) => !only.length || only.includes(c.slug));
  let api = null;
  if (write) {
    const { loadEnv, pb } = await import('./pb-lib.mjs');
    api = await pb(await loadEnv());
  }
  let problems = 0;
  for (const card of cards) {
    const form = cardToForm(card);
    const cov = coverage(card, form);
    const bad = badFilters(card, FILTERS_BY_CATEGORY[card.categorySlug]);
    const len = form.sections.reduce((n, x) => n + x.body.replace(/\s+/g, ' ').length, 0);
    const warn = [cov.pct < 99 && `текст ${cov.pct} % (${cov.lost.join(', ')})`, bad.length && `фильтры вне набора: ${bad.join(', ')}`, len < 150 && `текст ${len} знаков < 150`].filter(Boolean);
    if (warn.length) problems++;
    let done = '';
    if (api) {
      const rec = await api.first('specialists', `categorySlug = "${card.categorySlug}" && slug = "${card.slug}"`);
      if (!rec) { done = ' · НЕТ В БАЗЕ'; problems++; }
      else {
        // анкету, которую владелец уже правил через кабинет, не затираем
        const cur = rec.form && typeof rec.form === 'object' ? rec.form : {};
        if (cur.firstName && !cur.managed) { done = ' · в базе анкета из кабинета, пропуск'; }
        else {
          // контакты, которые владелец уже вписал, сохраняем
          if (cur.contacts && Object.keys(cur.contacts).length) form.contacts = cur.contacts;
          await api.update('specialists', rec.id, { form });
          done = ' · записано';
        }
      }
    }
    console.log(`${warn.length ? '!' : '✓'} ${card.categorySlug}/${card.slug}: ${form.sections.length} разд., ${len} зн., текст ${cov.pct} %, ` +
      `фильтров ${Object.keys(form.filters).length}, цена ${form.priceFrom || 'по запросу'}${done}${warn.length ? '\n    ' + warn.join('\n    ') : ''}`);
  }
  console.log(`\n${cards.length} карточек, с замечаниями ${problems}${write ? '' : ' (сухой прогон, в базу не писал — --write)'}`);
}
