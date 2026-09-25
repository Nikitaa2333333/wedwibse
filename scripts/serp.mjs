#!/usr/bin/env node
/**
 * Снимок выдачи Яндекса по семантическому ядру: кто реально стоит в топ-10
 * по нашим запросам. Из него считается доля голоса доменов (share of voice)
 * с весом по частотности запроса — это и есть список конкурентов по данным.
 *
 * Тот же Yandex Cloud Search API, что и Wordstat (SEO.md §6): ключи и
 * folderId из .env — WORDSTAT_API_KEY / WORDSTAT_FOLDER_ID (+ _2, _3 …).
 *
 *   node scripts/serp.mjs pick  core-msk 15      — собрать список запросов: топ-N
 *                                                  каждого кластера ядра → serp-out/queries-core-msk.txt
 *   node scripts/serp.mjs run   core-msk         — снять выдачу по списку → serp-out/serp-core-msk.csv
 *   node scripts/serp.mjs report core-msk        — доля голоса и типы страниц → serp-out/serp-core-msk.md
 *
 * Регион по умолчанию 213 (Москва). Выдача — десктопная, органика без рекламы
 * (в API рекламы нет), до 10 документов на запрос.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'scripts', 'serp-out');
const CORE_DIR = path.join(ROOT, 'scripts', 'wordstat-out');
const API = 'https://searchapi.api.cloud.yandex.net/v2/web/search';

let throttleMs = 700;

// ---------- окружение ----------
async function loadEnv() {
  const file = path.join(ROOT, '.env');
  if (existsSync(file)) {
    for (const line of (await readFile(file, 'utf8')).split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  const accounts = [];
  for (const suffix of ['', '_2', '_3', '_4']) {
    const key = process.env[`WORDSTAT_API_KEY${suffix}`];
    const folderId = process.env[`WORDSTAT_FOLDER_ID${suffix}`];
    if (key && folderId) accounts.push({ key, folderId });
  }
  if (!accounts.length) throw new Error('В .env нет WORDSTAT_API_KEY / WORDSTAT_FOLDER_ID');
  return accounts;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- запрос к API ----------
async function search(acc, queryText, region) {
  const body = {
    query: { searchType: 'SEARCH_TYPE_RU', queryText, page: '0', fixTypoMode: 'FIX_TYPO_MODE_ON' },
    groupSpec: { groupMode: 'GROUP_MODE_DEEP', groupsOnPage: '10', docsInGroup: '1' },
    region: String(region),
    l10n: 'LOCALIZATION_RU',
    folderId: acc.folderId,
    responseFormat: 'FORMAT_XML',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0 Safari/537.36',
  };
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(API, {
      method: 'POST',
      headers: { Authorization: `Api-Key ${acc.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.status === 429) {
      throttleMs = Math.min(throttleMs * 1.6, 5000);
      await sleep(throttleMs * 2);
      continue;
    }
    const text = await res.text();
    if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 300)}`);
    const json = JSON.parse(text);
    const xml = Buffer.from(json.rawData, 'base64').toString('utf8');
    return parseXml(xml);
  }
  throw new Error('429 не отпускает');
}

function parseXml(xml) {
  const docs = [];
  const re = /<doc[^>]*>([\s\S]*?)<\/doc>/g;
  let m;
  while ((m = re.exec(xml))) {
    const d = m[1];
    const url = (d.match(/<url>(.*?)<\/url>/) || [])[1] || '';
    const domain = (d.match(/<domain>(.*?)<\/domain>/) || [])[1] || '';
    const title = ((d.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '')
      .replace(/<\/?hlword>/g, '')
      .replace(/<[^>]+>/g, '')
      .trim();
    docs.push({ url, domain: domain.replace(/^www\./, ''), title });
  }
  return docs.slice(0, 10);
}

// ---------- pick: список запросов из ядра ----------
const JUNK = /сценари|сколько стоит .* на свадьбу$|симс|4 свадьбы|четыре свадьбы|годовщин|лет свадьб|платье|кольц|ижевск|спб|казан|екатеринбург|новосибирск/i;

async function pick(core, perCluster) {
  const csv = await readFile(path.join(CORE_DIR, `${core}-clean.csv`), 'utf8');
  const rows = csv
    .replace(/^﻿/, '')
    .split('\n')
    .slice(1)
    .map((l) => l.split(';'))
    .filter((r) => r.length >= 3)
    .map(([phrase, count, cluster]) => ({ phrase: phrase.trim(), count: +count, cluster: cluster.trim() }))
    .filter((r) => !JUNK.test(r.phrase));
  const byCluster = new Map();
  for (const r of rows) {
    if (!byCluster.has(r.cluster)) byCluster.set(r.cluster, []);
    byCluster.get(r.cluster).push(r);
  }
  const out = [];
  for (const [cluster, list] of byCluster) {
    list.sort((a, b) => b.count - a.count);
    for (const r of list.slice(0, perCluster)) out.push(`${r.phrase};${r.count};${cluster}`);
  }
  await mkdir(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `queries-${core}.txt`);
  await writeFile(file, out.join('\n') + '\n');
  console.log(`${out.length} запросов → ${path.relative(ROOT, file)}`);
}

// ---------- run: снять выдачу ----------
async function run(core, region) {
  const accounts = await loadEnv();
  const lines = (await readFile(path.join(OUT_DIR, `queries-${core}.txt`), 'utf8'))
    .split('\n')
    .filter(Boolean)
    .map((l) => l.split(';'));
  const outFile = path.join(OUT_DIR, `serp-${core}.csv`);
  const done = new Set();
  let out = 'query;count;cluster;pos;domain;url;title\n';
  if (existsSync(outFile)) {
    out = await readFile(outFile, 'utf8');
    for (const l of out.split('\n').slice(1)) if (l) done.add(l.split(';')[0]);
  }
  let i = 0;
  for (const [phrase, count, cluster] of lines) {
    i++;
    if (done.has(phrase)) continue;
    const acc = accounts[i % accounts.length];
    try {
      const docs = await search(acc, phrase, region);
      docs.forEach((d, k) => {
        out += [phrase, count, cluster, k + 1, d.domain, d.url, d.title.replace(/;/g, ',')].join(';') + '\n';
      });
      await writeFile(outFile, out);
      console.log(`${i}/${lines.length} ${phrase} — ${docs.length} док., топ: ${docs.slice(0, 3).map((d) => d.domain).join(', ')}`);
    } catch (e) {
      console.error(`${i}/${lines.length} ${phrase} — ОШИБКА ${e.message}`);
    }
    await sleep(throttleMs);
  }
  console.log(`→ ${path.relative(ROOT, outFile)}`);
}

// ---------- report: доля голоса ----------
function pageType(url) {
  const u = url.toLowerCase();
  if (/\/(blog|article|articles|stati|statya|journal|news|post|wiki|sovety|magazine)\//.test(u)) return 'статья';
  if (/\?|filter|catalog|katalog|poisk|search|list|banketnye|zaly|restorany|ploshchadki|mesta|usadby|loft/.test(u) && !/\/[^/]+\/[^/]+\/[^/]+\/?$/.test(u)) return 'подборка';
  const depth = u.replace(/^https?:\/\/[^/]+/, '').split('/').filter(Boolean).length;
  if (depth === 0) return 'главная';
  if (depth >= 3) return 'карточка';
  return 'подборка';
}

async function report(core) {
  const csv = await readFile(path.join(OUT_DIR, `serp-${core}.csv`), 'utf8');
  const rows = csv
    .split('\n')
    .slice(1)
    .filter(Boolean)
    .map((l) => l.split(';'))
    .map(([query, count, cluster, pos, domain, url, title]) => ({ query, count: +count, cluster, pos: +pos, domain, url, title }));
  const queries = new Set(rows.map((r) => r.query));
  const totalWeight = [...queries].reduce((s, q) => s + rows.find((r) => r.query === q).count, 0);

  // Вес домена = сумма частот запросов, где он в топ-10, с поправкой на позицию (1 → 1.0, 10 → 0.1)
  const dom = new Map();
  for (const r of rows) {
    const d = dom.get(r.domain) || { hits: 0, top3: 0, weight: 0, clusters: new Map(), types: new Map(), urls: new Set() };
    d.hits++;
    if (r.pos <= 3) d.top3++;
    d.weight += r.count * (11 - r.pos) / 10;
    d.clusters.set(r.cluster, (d.clusters.get(r.cluster) || 0) + 1);
    const t = pageType(r.url);
    d.types.set(t, (d.types.get(t) || 0) + 1);
    d.urls.add(r.url);
    dom.set(r.domain, d);
  }
  const ranked = [...dom].sort((a, b) => b[1].weight - a[1].weight);

  let md = `# Выдача Яндекса по ядру ${core}\n\n`;
  md += `Снято ${new Date().toISOString().slice(0, 10)}, регион 213, ${queries.size} запросов, топ-10 органики.\n`;
  md += `Вес домена — сумма частот запросов, где он в топ-10, с поправкой на позицию (1-я → 1,0; 10-я → 0,1).\n`;
  md += `Доля — от суммы частот всех запросов (${totalWeight}).\n\n`;
  md += `## Доля голоса: топ-30 доменов\n\n| # | Домен | Доля | В топ-10 | В топ-3 | Кластеры | Тип страниц |\n| ---: | --- | ---: | ---: | ---: | --- | --- |\n`;
  ranked.slice(0, 30).forEach(([domain, d], i) => {
    const cl = [...d.clusters].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ${n}`).join(', ');
    const ty = [...d.types].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} ${n}`).join(', ');
    md += `| ${i + 1} | ${domain} | ${(100 * d.weight / totalWeight).toFixed(1)} % | ${d.hits} | ${d.top3} | ${cl} | ${ty} |\n`;
  });

  // По кластерам: кто держит каждый
  md += `\n## Кто держит каждый кластер (топ-5 по весу)\n\n`;
  const clusters = [...new Set(rows.map((r) => r.cluster))];
  for (const c of clusters) {
    const sub = new Map();
    for (const r of rows.filter((r) => r.cluster === c)) {
      sub.set(r.domain, (sub.get(r.domain) || 0) + r.count * (11 - r.pos) / 10);
    }
    const top = [...sub].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const w = [...new Set(rows.filter((r) => r.cluster === c).map((r) => r.query))].reduce(
      (s, q) => s + rows.find((r) => r.query === q).count, 0);
    md += `**${c}** (${w} показов): ` + top.map(([d, v]) => `${d} ${(100 * v / w).toFixed(0)} %`).join(' · ') + '\n\n';
  }

  // Типы страниц в топ-3 — что вообще ранжируется
  md += `## Какие страницы стоят в топ-3\n\n`;
  const t3 = new Map();
  for (const r of rows.filter((r) => r.pos <= 3)) {
    const t = pageType(r.url);
    t3.set(t, (t3.get(t) || 0) + 1);
  }
  const t3total = [...t3.values()].reduce((a, b) => a + b, 0);
  md += [...t3].sort((a, b) => b[1] - a[1]).map(([t, n]) => `- ${t}: ${n} (${(100 * n / t3total).toFixed(0)} %)`).join('\n') + '\n\n';

  // Полная выдача по запросам (топ-5) — для чтения глазами
  md += `## Топ-5 по каждому запросу\n\n`;
  for (const q of queries) {
    const sub = rows.filter((r) => r.query === q && r.pos <= 5);
    md += `**${q}** (${sub[0]?.count}, ${sub[0]?.cluster})\n`;
    for (const r of sub) md += `${r.pos}. ${r.domain} — ${r.title.slice(0, 80)} — ${r.url}\n`;
    md += '\n';
  }
  const file = path.join(OUT_DIR, `serp-${core}.md`);
  await writeFile(file, md);
  console.log(`→ ${path.relative(ROOT, file)}`);
  console.log(md.split('## Кто держит')[0]);
}

// ---------- CLI ----------
const [cmd, core = 'core-msk', arg] = process.argv.slice(2);
if (cmd === 'pick') await pick(core, +arg || 15);
else if (cmd === 'run') await run(core, +arg || 213);
else if (cmd === 'report') await report(core);
else console.log('Команды: pick <core> [N] · run <core> [region] · report <core>');
