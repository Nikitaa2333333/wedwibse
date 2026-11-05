#!/usr/bin/env node
// ПУНКТ УПРАВЛЕНИЯ — правка карты проекта docs/map/data.js одной командой.
// Карту обновляет КАЖДАЯ сессия, локальная и облачная (скилл control-map).
// Файл данных руками не правим: 5000+ строк, одна запятая — и карта пустая.
//
//   node scripts/map.mjs session итог.json        — итог сессии в ленту «Сессии» (новые сверху)
//   node scripts/map.mjs step <дорожка> "<часть текста шага>" <статус> ["заметка"]
//   node scripts/map.mjs add-step <дорожка> "<текст>" <статус> ["заметка"] ["источник"]
//   node scripts/map.mjs issue "<часть названия>" <статус> ["как чиним / что сделано"]
//   node scripts/map.mjs add-issue "<название>" <high|mid|low> "<область>" "<как чиним>" ["где в коде"]
//   node scripts/map.mjs decision "<тема>" "<решение>"   — дата сегодняшняя
//   node scripts/map.mjs find "<текст>"                 — где на карте это есть
//   node scripts/map.mjs check                          — проверка целостности (стоит в деплое)
//
// Статусы: done — сделано, work — в работе, todo — впереди, bad — сломано/долг,
// block — ждёт внешнего (юрист, доступы, заказчик).
// Итог сессии (JSON): { title, where: "локально"|"облако", summary,
//   done: [...], decided: [...], next: [...], tracks: ["clean", ...],
//   commits: ["abc1234", ...], branch?, date? (по умолчанию сегодня) }
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = 'docs/map/data.js';
const STATUSES = ['done', 'work', 'todo', 'bad', 'block'];
const today = () => new Date().toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' }).replace(/\//g, '.');

function load() {
  const src = readFileSync(FILE, 'utf8');
  const at = src.indexOf('window.MAP');
  if (at < 0) fail('в docs/map/data.js нет window.MAP');
  const ctx = { window: {} };
  new Function('window', src)(ctx.window);
  return { head: src.slice(0, at), map: ctx.window.MAP };
}
function save({ head, map }) {
  map.updated = today();
  const problems = validate(map);
  if (problems.length) fail('карта не сохранена — ошибки:\n  ' + problems.join('\n  '));
  writeFileSync(FILE, head + 'window.MAP = ' + JSON.stringify(map, null, 1) + ';\n');
}
function fail(msg) { console.error('map: ' + msg); process.exit(1); }
const norm = (s) => String(s ?? '').toLowerCase().replace(/ё/g, 'е');

function validate(m) {
  const out = [];
  const st = (s, where) => { if (!STATUSES.includes(s)) out.push(`${where}: статус «${s}» — нужен один из ${STATUSES.join('/')}`); };
  if (!Array.isArray(m.tracks)) out.push('нет tracks');
  const ids = new Set();
  for (const t of m.tracks ?? []) {
    if (ids.has(t.id)) out.push(`дорожка ${t.id} повторяется`);
    ids.add(t.id);
    if (!m.stages?.some((s) => s.id === t.stage)) out.push(`дорожка ${t.id}: нет этапа ${t.stage}`);
    (t.steps ?? []).forEach((s, i) => { if (!s.t) out.push(`${t.id}[${i}]: шаг без текста`); st(s.s, `${t.id}[${i}]`); });
  }
  const nodes = new Set((m.system?.nodes ?? []).map((n) => n.id));
  for (const l of m.system?.links ?? []) if (!nodes.has(l.a) || !nodes.has(l.b)) out.push(`связь ${l.a} → ${l.b}: нет узла`);
  (m.issues ?? []).forEach((x, i) => st(x.s, `проблема ${i} «${x.t}»`));
  for (const s of m.sessions ?? []) {
    if (!s.date || !s.title) out.push(`сессия без даты или названия: ${JSON.stringify(s).slice(0, 80)}`);
    for (const id of s.tracks ?? []) if (!ids.has(id)) out.push(`сессия «${s.title}»: нет дорожки ${id}`);
  }
  return out;
}
function oneStep(map, trackId, piece) {
  const tr = map.tracks.find((t) => t.id === trackId);
  if (!tr) fail(`нет дорожки «${trackId}». Есть: ${map.tracks.map((t) => t.id).join(', ')}`);
  const n = Number(piece);
  if (Number.isInteger(n) && tr.steps[n]) return tr.steps[n];
  const hits = tr.steps.filter((s) => norm(s.t).includes(norm(piece)));
  if (hits.length !== 1) fail(`шагов с «${piece}» в ${trackId}: ${hits.length}${hits.length ? ' — уточни:\n  ' + hits.map((s) => s.t).join('\n  ') : ''}`);
  return hits[0];
}

const [cmd, ...a] = process.argv.slice(2);
const doc = cmd && cmd !== 'check' && cmd !== 'find' ? load() : null;

switch (cmd) {
  case 'session': {
    if (!a[0]) fail('нужен файл итога: node scripts/map.mjs session итог.json');
    const s = JSON.parse(readFileSync(a[0], 'utf8'));
    s.date ??= today();
    s.where ??= 'локально';
    for (const k of ['done', 'decided', 'next', 'tracks', 'commits']) s[k] ??= [];
    s.id ??= `${s.date}-${norm(s.title).replace(/[^a-zа-я0-9]+/g, '-').slice(0, 40)}`;
    doc.map.sessions ??= [];
    const was = doc.map.sessions.findIndex((x) => x.id === s.id);
    if (was >= 0) doc.map.sessions[was] = s; else doc.map.sessions.unshift(s);
    save(doc);
    console.log(`сессия «${s.title}» (${s.date}, ${s.where}) ${was >= 0 ? 'обновлена' : 'записана'}`);
    break;
  }
  case 'step': {
    const [trackId, piece, s, note] = a;
    if (!STATUSES.includes(s)) fail(`статус: ${STATUSES.join('/')}`);
    const step = oneStep(doc.map, trackId, piece);
    step.s = s;
    if (note) step.note = note;
    step.date = today();
    save(doc);
    console.log(`${trackId}: «${step.t}» → ${s}`);
    break;
  }
  case 'add-step': {
    const [trackId, t, s, note, src] = a;
    const tr = doc.map.tracks.find((x) => x.id === trackId);
    if (!tr) fail(`нет дорожки «${trackId}»`);
    tr.steps.push({ t, s, ...(note ? { note } : {}), ...(src ? { src } : {}), date: today() });
    save(doc);
    console.log(`${trackId}: добавлен «${t}» (${s})`);
    break;
  }
  case 'issue': {
    const [piece, s, fix] = a;
    const hits = doc.map.issues.filter((x) => norm(x.t).includes(norm(piece)));
    if (hits.length !== 1) fail(`проблем с «${piece}»: ${hits.length}${hits.length ? '\n  ' + hits.map((x) => x.t).join('\n  ') : ''}`);
    hits[0].s = s;
    if (fix) hits[0].fix = fix;
    save(doc);
    console.log(`проблема «${hits[0].t}» → ${s}`);
    break;
  }
  case 'add-issue': {
    const [t, sev, area, fix, where] = a;
    if (!['high', 'mid', 'low'].includes(sev)) fail('важность: high/mid/low');
    doc.map.issues.unshift({ t, sev, area, fix, where: where ?? '', s: 'bad', src: `сессия ${today()}` });
    save(doc);
    console.log(`проблема добавлена: «${t}»`);
    break;
  }
  case 'decision': {
    const [topic, decision] = a;
    doc.map.decisions.unshift({ topic, decision, date: today(), src: 'сессия' });
    save(doc);
    console.log(`решение записано: ${topic}`);
    break;
  }
  case 'find': {
    const { map } = load();
    const q = norm(a.join(' '));
    for (const t of map.tracks) t.steps.forEach((s, i) => norm(s.t + ' ' + (s.note ?? '')).includes(q) && console.log(`шаг   ${t.id}[${i}] ${s.s.padEnd(5)} ${s.t}`));
    for (const x of map.issues) norm(x.t + ' ' + x.fix).includes(q) && console.log(`проблема ${x.s.padEnd(5)} ${x.t}`);
    for (const x of map.sessions ?? []) norm(JSON.stringify(x)).includes(q) && console.log(`сессия ${x.date} ${x.title}`);
    break;
  }
  case 'check': {
    const { map } = load();
    const problems = validate(map);
    if (problems.length) fail('ошибки в карте:\n  ' + problems.join('\n  '));
    const steps = map.tracks.flatMap((t) => t.steps);
    console.log(`карта цела: ${map.tracks.length} дорожек, ${steps.length} шагов, ${map.issues.length} проблем, ${(map.sessions ?? []).length} сессий; обновлена ${map.updated}`);
    break;
  }
  default:
    console.log(readFileSync(new URL(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n'));
}
