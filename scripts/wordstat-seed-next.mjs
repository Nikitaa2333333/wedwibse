#!/usr/bin/env node
/**
 * Готовит затравки для второго прохода: берёт уже собранное ядро и вытаскивает
 * из каждого кластера самые частотные фразы, которых не было в первом списке.
 * Так ядро расширяет себя само — формулировками рынка, а не нашими догадками.
 *
 *   node scripts/wordstat-seed-next.mjs [core-msk] [сколько на кластер]
 *
 * Пишет scripts/wordstat-seed-2.txt (ручные добавки в конце файла сохраняются).
 */

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'scripts', 'wordstat-out');
const name = process.argv[2] ?? 'core-msk';
const perCluster = Number(process.argv[3] ?? 35);

const rows = (await readFile(path.join(OUT_DIR, `${name}-clean.csv`), 'utf8'))
  .replace(/^﻿/, '')
  .split('\n')
  .slice(1)
  .map((l) => l.split(';'))
  .filter((a) => a.length > 2)
  .map((a) => ({ phrase: a[0], count: Number(a[1]), cluster: a[2] }));

// Затравки первого прохода повторять незачем — их хвост уже собран.
const used = new Set(
  (await readFile(path.join(ROOT, 'scripts', 'wordstat-seed.txt'), 'utf8'))
    .split('\n')
    .map((s) => s.replace(/#.*$/, '').trim().toLowerCase())
    .filter(Boolean)
);

// Слишком длинная фраза — уже хвост: разворачивать её нечего.
const isSeedable = (p) => {
  const words = p.phrase.split(/\s+/).length;
  return words >= 2 && words <= 4 && !used.has(p.phrase);
};

const byCluster = new Map();
for (const r of rows.filter(isSeedable)) {
  if (!byCluster.has(r.cluster)) byCluster.set(r.cluster, []);
  byCluster.get(r.cluster).push(r);
}

const picked = [];
for (const [cluster, list] of byCluster) {
  const top = list.sort((a, b) => b.count - a.count).slice(0, perCluster);
  picked.push({ cluster, top });
}

const lines = [
  '# Затравки второго прохода — сгенерированы из ядра первого',
  `# (${name}-clean.csv, топ-${perCluster} по каждому кластеру).`,
  '# Пересобрать: node scripts/wordstat-seed-next.mjs',
  '',
];
for (const { cluster, top } of picked) {
  lines.push(`# --- ${cluster} ---`);
  lines.push(...top.map((r) => r.phrase));
  lines.push('');
}

// Ручной хвост файла (всё после маркера) переносим как есть.
const MARK = '# ==== РУЧНЫЕ ДОБАВКИ ====';
const target = path.join(ROOT, 'scripts', 'wordstat-seed-2.txt');
let manual = '';
if (existsSync(target)) {
  const prev = await readFile(target, 'utf8');
  const idx = prev.indexOf(MARK);
  if (idx >= 0) manual = prev.slice(idx);
}
lines.push(manual || `${MARK}\n# сюда дописываем руками то, чего в ядре ещё нет\n`);

await writeFile(target, lines.join('\n'), 'utf8');
console.log(
  `Затравок: ${picked.reduce((s, p) => s + p.top.length, 0)} из ${byCluster.size} кластеров → scripts/wordstat-seed-2.txt`
);
