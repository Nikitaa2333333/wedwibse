#!/usr/bin/env node
// ============================================================
// ОБРАБОТЧИК НАРЕЗКИ ФОТО (сервис фото, 07.11.2026, docs/PHOTO-SERVICE.md).
//
// Живёт на сервере службой wedsecrets-photo (пользователь deploy). Сам ничего
// не режет и на диск не пишет: запрашивает варианты у внутреннего адреса nginx
// (CUT_URL, 127.0.0.1:8088), тот режет их через imgproxy и сохраняет файлом
// (proxy_store). Уже лежащий на диске вариант не запрашивается вовсе —
// «второй раз не режем».
//
// Откуда берётся работа:
//  1. Очередь (PHOTO_QUEUE) — хук базы кладёт туда файл со списком кадров:
//     по «Готово» подрядчика (кадры ревизии) и при сохранении карточки
//     (одобрение, pb-seed --publish). Строка — «<коллекция>/<запись>/<имя>».
//  2. Обход раз в SWEEP_MIN минут — все кадры сборки (_astro) и все файлы
//     карточек (CARD_COLLS): то, что очередь пропустила (служба стояла,
//     новая выкладка сайта), дорежется само.
// Режем строго по одному: сервер на 2 ядра, страницы важнее.
//
// Запуск руками (разовый проход без цикла): node scripts/photo-worker.mjs --once
// ============================================================
import { readdir, readFile, rm, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { PHOTO_WIDTHS, photoUrl, storeKey } from '../src/lib/photo-url.mjs';

const env = (k, d) => process.env[k] || d;
const QUEUE = env('PHOTO_QUEUE', '/srv/wedsecrets-photos/queue');
const STORE = env('PHOTO_STORE', '/srv/wedsecrets-photos/store');
const PB_STORAGE = env('PB_STORAGE', '/srv/wedsecrets-pb/pb_data/storage');
const SITE_ASTRO = env('SITE_ASTRO', '/var/www/wedsecrets/_astro');
const CUT_URL = env('CUT_URL', 'http://127.0.0.1:8088').replace(/\/$/, '');
/** id коллекций карточек (specialists, venues) через запятую — их файлы публичные */
const CARD_COLLS = env('CARD_COLLS', '').split(',').map((s) => s.trim()).filter(Boolean);
const SWEEP_MS = Number(env('SWEEP_MIN', '10')) * 60_000;
const PAUSE_MS = Number(env('PAUSE_MS', '50'));
const ONCE = process.argv.includes('--once');

const IMG = /\.(webp|jpe?g|png|avif)$/i;
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
const log = (...a) => console.log(new Date().toISOString().slice(0, 19), ...a);

/** нарезать все ширины одного кадра; вернёт, сколько вариантов пришлось резать */
async function cut(src) {
  let made = 0;
  for (const w of PHOTO_WIDTHS) {
    const key = storeKey(src, w);
    if (key && existsSync(join(STORE, key))) continue;
    const url = CUT_URL + photoUrl(src, w);
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(120_000) });
      await r.arrayBuffer(); // дочитать: nginx сохраняет файл, когда ответ дошёл целиком
      if (!r.ok) { log(`ошибка ${r.status}: ${url}`); return made; } // битый оригинал — остальные ширины не мучаем
      made++;
    } catch (err) {
      log(`не ответил: ${url} — ${err.message}`);
      return made;
    }
    if (PAUSE_MS) await sleep(PAUSE_MS);
  }
  return made;
}

/** строка очереди или путь в хранилище базы → источник */
function pbSource(line) {
  const [coll, rec, ...rest] = line.trim().split('/');
  const name = rest.join('/');
  if (!coll || !rec || !name || !IMG.test(name)) return null;
  return { kind: 'f', coll, rec, name };
}

async function drainQueue() {
  let files;
  try { files = (await readdir(QUEUE)).filter((f) => f.endsWith('.txt')).sort(); } catch { return 0; }
  let made = 0;
  for (const f of files) {
    const path = join(QUEUE, f);
    // хук пишет файл целиком одним вызовом, но свежий (моложе 2 с) не трогаем
    try { if (Date.now() - (await stat(path)).mtimeMs < 2000) continue; } catch { continue; }
    const lines = (await readFile(path, 'utf8')).split('\n').map(pbSource).filter(Boolean);
    for (const src of lines) made += await cut(src);
    await rm(path, { force: true });
    log(`очередь ${f}: кадров ${lines.length}, нарезано вариантов ${made}`);
  }
  return made;
}

async function list(dir) {
  try { return await readdir(dir, { withFileTypes: true }); } catch { return []; }
}

async function sweep() {
  const started = Date.now();
  let seen = 0, made = 0;
  // кадры сборки: в _astro лежат оригиналы (с PHOTO_SERVICE=1 сборка вариантов не делает)
  for (const d of await list(SITE_ASTRO)) {
    if (!d.isFile() || !IMG.test(d.name)) continue;
    seen++;
    made += await cut({ kind: 'a', file: d.name });
    made += await drainQueue(); // «Готово» подрядчика не ждёт конца обхода
  }
  // файлы карточек; папки thumbs_* — миниатюры самой базы, их пропускаем
  for (const coll of CARD_COLLS) {
    for (const rec of await list(join(PB_STORAGE, coll))) {
      if (!rec.isDirectory()) continue;
      for (const f of await list(join(PB_STORAGE, coll, rec.name))) {
        if (!f.isFile() || !IMG.test(f.name)) continue;
        seen++;
        made += await cut({ kind: 'f', coll, rec: rec.name, name: f.name });
      }
      made += await drainQueue();
    }
  }
  log(`обход: кадров ${seen}, нарезано вариантов ${made}, ${Math.round((Date.now() - started) / 1000)} с`);
}

async function main() {
  if (!CARD_COLLS.length) log('внимание: CARD_COLLS пуст — файлы карточек обходом не проверяются');
  if (ONCE) { await drainQueue(); await sweep(); return; }
  let nextSweep = 0;
  for (;;) {
    if (Date.now() >= nextSweep) { await sweep(); nextSweep = Date.now() + SWEEP_MS; }
    await drainQueue();
    await sleep(5000);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
