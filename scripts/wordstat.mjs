#!/usr/bin/env node
/**
 * Обвязка над Wordstat API (Yandex Cloud Search API v2).
 * Зависимостей нет: Node 22 + встроенный fetch.
 *
 * Ключи берутся из .env в корне репозитория (файл в .gitignore):
 *   WORDSTAT_API_KEY=AQVN...        — Api-Key сервисного аккаунта из AI Studio
 *   WORDSTAT_FOLDER_ID=b1g...       — каталог Yandex Cloud, обязателен в теле каждого запроса
 *
 * Команды:
 *   node scripts/wordstat.mjs top "аренда лофта для свадьбы" [--num 300] [--regions 213,1]
 *   node scripts/wordstat.mjs batch scripts/wordstat-seed.txt [--num 500] [--regions 213,1] [--out core]
 *   node scripts/wordstat.mjs dynamics "свадебная площадка" --from 2023-01-01 --to 2026-08-31 [--period monthly]
 *   node scripts/wordstat.mjs regions "свадебная площадка" [--level cities]
 *   node scripts/wordstat.mjs tree
 *
 * Регионы: 213 — Москва, 1 — Московская область, 2 — Санкт-Петербург.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'scripts', 'wordstat-out');
const API_BASE = 'https://searchapi.api.cloud.yandex.net/v2/wordstat';

// Между вызовами держим паузу. Лимит плавающий: на длинных прогонах
// (сотни затравок) 250 мс упирается в 429, поэтому базовая пауза больше,
// а каждый пойманный 429 её ещё поднимает — до потолка.
let throttleMs = 600;
const THROTTLE_MAX = 2500;

// ГЛАВНОЕ ограничение API: 100 запросов в час на аккаунт
// («wordstatRequestsPerHour.rate rate quota limit exceed: allowed 100 requests»).
// Не RPS — именно часовое окно, поэтому длинный список затравок физически
// не проходит за один заход: держим скользящее окно и ждём, когда оно освободится.
// Квота считается на аккаунт, поэтому ключей может быть несколько: скрипт
// сам переключается на следующий свежий и ждёт только когда исчерпаны все.
const HOUR_MS = 60 * 60 * 1000;
const HOUR_QUOTA = 95; // с запасом от 100: часть попыток съедают ретраи

/** Выбирает аккаунт с незанятой квотой; если свободных нет — ждёт ближайший. */
async function pickAccount(env) {
  for (;;) {
    const now = Date.now();
    for (const acc of env.accounts) {
      while (acc.times.length && now - acc.times[0] > HOUR_MS) acc.times.shift();
    }

    const free = env.accounts.find((a) => a.times.length < HOUR_QUOTA);
    if (free) {
      if (free !== env.current) {
        env.current = free;
        console.log(`\n  Переключаюсь на ключ ${free.label}.`);
      }
      return free;
    }

    const soonest = Math.min(...env.accounts.map((a) => a.times[0] + HOUR_MS));
    const waitMs = soonest - now + 5000;
    console.log(
      `\n  Квота выбрана на всех ключах (${env.accounts.length}). ` +
        `Ждём до ${new Date(soonest + 5000).toLocaleTimeString('ru')}…`
    );
    await sleep(Math.min(waitMs, 5 * 60 * 1000));
  }
}

// ---------- окружение ----------

async function loadEnv() {
  const file = path.join(ROOT, '.env');
  if (existsSync(file)) {
    const text = await readFile(file, 'utf8');
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  // Первый аккаунт — без суффикса, дальше _2, _3 … (квота считается на каждый).
  const accounts = [];
  for (const suffix of ['', '_2', '_3', '_4', '_5']) {
    const key = process.env[`WORDSTAT_API_KEY${suffix}`];
    const folderId = process.env[`WORDSTAT_FOLDER_ID${suffix}`];
    if (key && folderId) {
      accounts.push({ key, folderId, label: suffix ? suffix.slice(1) : '1', times: [] });
    }
  }
  if (!accounts.length) {
    die(
      'Нет доступов. Положи в .env корня репозитория:\n' +
        '  WORDSTAT_API_KEY=<Api-Key из AI Studio>\n' +
        '  WORDSTAT_FOLDER_ID=<идентификатор каталога Yandex Cloud>\n' +
        'Второй аккаунт — те же переменные с суффиксом _2.'
    );
  }
  if (accounts.length > 1) console.log(`Ключей в работе: ${accounts.length}`);
  return { accounts, current: accounts[0] };
}

// ---------- транспорт ----------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @param {object} opts  soft: вернуть null вместо выхода, когда попытки кончились
 *                       (нужно в batch — одна упрямая фраза не должна убивать прогон)
 */
async function call(env, method, body, opts = {}, attempt = 1) {
  const acc = await pickAccount(env);
  acc.times.push(Date.now());

  // Сеть рвётся на длинных прогонах (ECONNRESET, таймауты) — это не ответ
  // сервера, а исключение, и без обработки оно убивало весь прогон целиком.
  let res;
  try {
    res = await fetch(`${API_BASE}/${method}`, {
      method: 'POST',
      headers: {
        Authorization: `Api-Key ${acc.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...body, folderId: acc.folderId }),
      signal: AbortSignal.timeout(60000),
    });
  } catch (err) {
    const reason = err?.cause?.code ?? err?.name ?? 'ошибка сети';
    if (attempt >= 6) {
      if (opts.soft) {
        console.log(`\n  ! ${method}: ${reason}, попытки кончились`);
        return null;
      }
      die(`${method}: ${reason} после ${attempt} попыток`);
    }
    console.log(`\n  ${reason} — повтор через ${2 ** attempt} с`);
    await sleep(Math.min(2 ** attempt * 1000, 40000));
    return call(env, method, body, opts, attempt + 1);
  }

  if (res.status === 429 || res.status >= 500) {
    if (res.status === 429) {
      const text = await res.clone().text();
      // Часовая квота — это не «притормози на секунду», а «этот ключ на сегодня
      // всё». Считаем его исчерпанным: pickAccount уйдёт на следующий ключ,
      // а если других нет — дождётся окна. Попытку при этом не тратим.
      if (/quota/i.test(text)) {
        const now = Date.now();
        acc.times = Array.from({ length: HOUR_QUOTA }, () => now);
        console.log(`\n  Ключ ${acc.label}: часовая квота исчерпана.`);
        return call(env, method, body, opts, attempt);
      }
      // Обычный троттлинг — замедляемся насовсем, а не только в этой попытке.
      throttleMs = Math.min(throttleMs + 300, THROTTLE_MAX);
    }
    if (attempt >= 6) {
      if (opts.soft) return null;
      die(`${method}: ${res.status} после ${attempt} попыток`);
    }
    await sleep(Math.min(2 ** attempt * 1000, 40000));
    return call(env, method, body, opts, attempt + 1);
  }
  if (!res.ok) {
    const text = (await res.text()).slice(0, 500);
    if (opts.soft) {
      console.log(`\n  ! ${method} HTTP ${res.status}: ${text.slice(0, 120)}`);
      return null;
    }
    die(`${method}: HTTP ${res.status}\n${text}`);
  }
  return res.json();
}

// count приходит строкой (int64 в protobuf сериализуется в JSON строкой).
const num = (v) => Number(v ?? 0);

// ---------- команды ----------

async function cmdTop(env, phrase, opts) {
  const data = await call(env, 'topRequests', {
    phrase,
    numPhrases: opts.num ?? 300,
    ...(opts.regions ? { regions: opts.regions } : {}),
    ...(opts.devices ? { devices: opts.devices } : {}),
  });

  const total = num(data.totalCount);
  console.log(`\n«${phrase}» — всего ${total.toLocaleString('ru')} показов/мес\n`);
  print('ТОП', data.results);
  print('АССОЦИАЦИИ', data.associations);
  return data;
}

function print(title, rows) {
  if (!rows?.length) return;
  console.log(title);
  for (const r of rows.slice(0, 40)) {
    console.log(`  ${String(num(r.count)).padStart(8)}   ${r.phrase}`);
  }
  console.log('');
}

/**
 * Прогон списка фраз: собирает и results, и associations в одно ядро.
 * Ассоциации важны отдельно — там всплывают формулировки, до которых
 * сам не додумаешься (другое слово для того же интента).
 */
async function cmdBatch(env, listFile, opts) {
  const text = await readFile(path.resolve(ROOT, listFile), 'utf8');
  const seeds = text
    .split('\n')
    .map((s) => s.replace(/#.*$/, '').trim())
    .filter(Boolean);

  const core = new Map(); // фраза → { phrase, count, kinds, seeds }
  const totals = [];
  const skipped = [];
  const name = opts.out ?? 'core';

  // Из-за часовой квоты длинный список идёт в несколько заходов, поэтому
  // по умолчанию продолжаем прошлый прогон: уже снятые затравки пропускаем.
  // Начать с нуля — флаг --fresh.
  const prevFile = path.join(OUT_DIR, `${name}.json`);
  const done = new Set();
  if (existsSync(prevFile) && opts.fresh === undefined) {
    const prev = JSON.parse(await readFile(prevFile, 'utf8'));
    for (const p of prev.phrases ?? []) {
      core.set(p.phrase, {
        phrase: p.phrase,
        count: p.count,
        kinds: new Set(p.kinds),
        seeds: new Set(p.seeds),
      });
    }
    for (const t of prev.seeds ?? []) {
      totals.push(t);
      done.add(t.seed);
    }
    console.log(`Продолжаем прошлый прогон: ${done.size} затравок уже снято, ${core.size} фраз в ядре.\n`);
  }

  for (const [i, seed] of seeds.entries()) {
    if (done.has(seed)) continue;
    process.stdout.write(`[${i + 1}/${seeds.length}] ${seed} … `);
    const data = await call(
      env,
      'topRequests',
      {
        phrase: seed,
        numPhrases: opts.num ?? 500,
        ...(opts.regions ? { regions: opts.regions } : {}),
        ...(opts.devices ? { devices: opts.devices } : {}),
      },
      { soft: true }
    );

    // Одна упрямая фраза не должна обнулять час работы: пропускаем и идём дальше.
    if (!data) {
      skipped.push(seed);
      console.log('пропущено');
      await sleep(throttleMs);
      continue;
    }

    const add = (rows, kind) => {
      for (const r of rows ?? []) {
        const keyPhrase = r.phrase.trim().toLowerCase();
        const prev = core.get(keyPhrase);
        if (prev) {
          prev.count = Math.max(prev.count, num(r.count));
          prev.kinds.add(kind);
          prev.seeds.add(seed);
        } else {
          core.set(keyPhrase, {
            phrase: keyPhrase,
            count: num(r.count),
            kinds: new Set([kind]),
            seeds: new Set([seed]),
          });
        }
      }
    };
    add(data.results, 'top');
    add(data.associations, 'assoc');

    totals.push({ seed, totalCount: num(data.totalCount) });
    console.log(
      `${num(data.totalCount).toLocaleString('ru')} / +${(data.results?.length ?? 0) + (data.associations?.length ?? 0)} фраз`
    );
    await sleep(throttleMs);

    // Промежуточное сохранение: прогон на сотни затравок идёт минутами,
    // и обрыв в середине не должен стоить всей собранной выборки.
    if ((i + 1) % 25 === 0) await save(core, totals, skipped, name, opts);
  }

  const rows = await save(core, totals, skipped, name, opts);

  console.log(`\nЯдро: ${rows.length} уникальных фраз → scripts/wordstat-out/${name}.csv (и .json)`);
  if (skipped.length) console.log(`Пропущено затравок: ${skipped.length} — ${skipped.join(', ')}`);
  console.log('Топ-20 ядра:');
  for (const r of rows.slice(0, 20)) console.log(`  ${String(r.count).padStart(8)}   ${r.phrase}`);
}

async function save(core, totals, skipped, name, opts) {
  const rows = [...core.values()].sort((a, b) => b.count - a.count);
  await mkdir(OUT_DIR, { recursive: true });

  const csv = [
    'phrase;count;kind;seeds',
    ...rows.map(
      (r) => `${csvCell(r.phrase)};${r.count};${[...r.kinds].join('+')};${csvCell([...r.seeds].join(' | '))}`
    ),
  ].join('\n');
  await writeFile(path.join(OUT_DIR, `${name}.csv`), '﻿' + csv, 'utf8');
  await writeFile(
    path.join(OUT_DIR, `${name}.json`),
    JSON.stringify(
      {
        collectedAt: new Date().toISOString(),
        regions: opts.regions ?? null,
        seeds: totals,
        skipped,
        phrases: rows.map((r) => ({ phrase: r.phrase, count: r.count, kinds: [...r.kinds], seeds: [...r.seeds] })),
      },
      null,
      2
    ),
    'utf8'
  );
  return rows;
}

const csvCell = (s) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

async function cmdDynamics(env, phrase, opts) {
  const period = { daily: 'PERIOD_DAILY', weekly: 'PERIOD_WEEKLY', monthly: 'PERIOD_MONTHLY' }[
    opts.period ?? 'monthly'
  ];
  if (!period) die('--period: daily | weekly | monthly');
  if (!opts.from) die('нужен --from ГГГГ-ММ-ДД');

  // Для monthly сервер требует, чтобы toDate был последним днём месяца
  // (для weekly — последним днём недели). Иначе INVALID_ARGUMENT.
  const from = new Date(`${opts.from}T00:00:00Z`);
  let to = opts.to ? new Date(`${opts.to}T23:59:59Z`) : new Date();
  if (period === 'PERIOD_MONTHLY') {
    to = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth() + 1, 0, 23, 59, 59));
  }

  const data = await call(env, 'dynamics', {
    phrase,
    period,
    fromDate: from.toISOString(),
    toDate: to.toISOString(),
    ...(opts.regions ? { regions: opts.regions } : {}),
  });

  console.log(`\n«${phrase}» — динамика (${opts.period ?? 'monthly'})\n`);
  for (const r of data.results ?? []) {
    console.log(`  ${r.date.slice(0, 10)}   ${String(num(r.count)).padStart(9)}`);
  }
  await mkdir(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `dynamics-${slug(phrase)}.json`);
  await writeFile(file, JSON.stringify(data, null, 2), 'utf8');
  console.log(`\n→ ${path.relative(ROOT, file)}`);
}

async function cmdRegions(env, phrase, opts) {
  const region = { all: 'REGION_ALL', cities: 'REGION_CITIES', regions: 'REGION_REGIONS' }[opts.level ?? 'cities'];
  if (!region) die('--level: all | cities | regions');

  const [data, tree] = await Promise.all([
    call(env, 'regions', { phrase, region }),
    loadRegionNames(env),
  ]);

  const rows = (data.results ?? [])
    .map((r) => ({ ...r, count: num(r.count), name: tree.get(String(r.region)) ?? r.region }))
    .sort((a, b) => b.count - a.count);

  console.log(`\n«${phrase}» — география (${opts.level ?? 'cities'})\n`);
  console.log('     показов   affinity   регион');
  for (const r of rows.slice(0, 30)) {
    console.log(`  ${String(r.count).padStart(10)}   ${String(r.affinityIndex?.toFixed(0) ?? '—').padStart(6)}   ${r.name}`);
  }
}

async function cmdTree(env) {
  const data = await call(env, 'getRegionsTree', {});
  await mkdir(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, 'regions-tree.json');
  await writeFile(file, JSON.stringify(data, null, 2), 'utf8');
  const flat = flatten(data.regions ?? []);
  console.log(`Справочник регионов: ${flat.length} узлов → ${path.relative(ROOT, file)}`);
  for (const r of flat.filter((r) => /москв|московская/i.test(r.label))) {
    console.log(`  ${String(r.id).padStart(6)}  ${r.label}`);
  }
}

// Справочник кэшируем: он на пару тысяч узлов и не меняется.
async function loadRegionNames(env) {
  const file = path.join(OUT_DIR, 'regions-tree.json');
  let data;
  if (existsSync(file)) {
    data = JSON.parse(await readFile(file, 'utf8'));
  } else {
    data = await call(env, 'getRegionsTree', {});
    await mkdir(OUT_DIR, { recursive: true });
    await writeFile(file, JSON.stringify(data, null, 2), 'utf8');
  }
  return new Map(flatten(data.regions ?? []).map((r) => [String(r.id), r.label]));
}

function flatten(nodes, acc = []) {
  for (const n of nodes) {
    acc.push({ id: n.id, label: n.label });
    if (n.children?.length) flatten(n.children, acc);
  }
  return acc;
}

// ---------- разбор аргументов ----------

function parseArgs(argv) {
  const positional = [];
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const value = argv[++i];
      if (key === 'regions') opts.regions = value.split(',').map((s) => s.trim());
      else if (key === 'devices') opts.devices = value.split(',').map((s) => `DEVICE_${s.trim().toUpperCase()}`);
      else if (key === 'num') opts.num = Number(value);
      else opts[key] = value;
    } else positional.push(a);
  }
  return { positional, opts };
}

const slug = (s) => s.toLowerCase().replace(/[^a-zа-я0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 60);

function die(msg) {
  console.error(`\n${msg}\n`);
  process.exit(1);
}

// ---------- вход ----------

const { positional, opts } = parseArgs(process.argv.slice(2));
const [command, arg] = positional;
const env = await loadEnv();

switch (command) {
  case 'top':
    if (!arg) die('node scripts/wordstat.mjs top "фраза"');
    await cmdTop(env, arg, opts);
    break;
  case 'batch':
    await cmdBatch(env, arg ?? 'scripts/wordstat-seed.txt', opts);
    break;
  case 'dynamics':
    if (!arg) die('node scripts/wordstat.mjs dynamics "фраза" --from 2023-01-01');
    await cmdDynamics(env, arg, opts);
    break;
  case 'regions':
    if (!arg) die('node scripts/wordstat.mjs regions "фраза"');
    await cmdRegions(env, arg, opts);
    break;
  case 'tree':
    await cmdTree(env);
    break;
  default:
    die(
      'Команды: top | batch | dynamics | regions | tree\n' +
        'Примеры:\n' +
        '  node scripts/wordstat.mjs top "аренда лофта для свадьбы" --regions 213,1\n' +
        '  node scripts/wordstat.mjs batch scripts/wordstat-seed.txt --regions 213,1 --num 500\n' +
        '  node scripts/wordstat.mjs dynamics "свадебная площадка" --from 2023-01-01\n' +
        '  node scripts/wordstat.mjs regions "свадьба в лофте" --level cities'
    );
}
