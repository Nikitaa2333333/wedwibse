// Забирает опубликованные площадки и подрядчиков из PocketBase в файлы сборки:
//   node scripts/pb-pull.mjs [--all]
// Для каждой записи venues со status = published пишет
// src/data/venues/<slug>.json (поле page) и скачивает фото в
// src/assets/venues/<slug>/ (только отсутствующие/изменившиеся по размеру).
// Для specialists — то же: src/data/specialists/<кат>/<slug>.json, фото
// и аватар в src/assets/specialists/…, ролики в public/reels/ (запись
// в data/reels.ts остаётся источником подписи и звука — её не трогаем).
// Дальше обычный astro build: пережатие и srcset делает astro:assets,
// сайт остаётся статикой. База — источник правды, файлы — её снимок.
// Без PB_URL в окружении скрипт молча выходит: локальные JSON остаются
// как есть (сборка без базы должна работать).
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { loadEnv, pb } from './pb-lib.mjs';

let cfg;
try { cfg = await loadEnv(); } catch { console.log('pb-pull: PB_URL не задан, пропускаю'); process.exit(0); }
const api = await pb(cfg);
const all = process.argv.includes('--all');
const res = await api.list('venues', all ? '' : `filter=${encodeURIComponent('status = "published"')}`);
console.log(`записей: ${res.items.length}`);

for (const rec of res.items) {
  const v = rec.page;
  if (!v?.slug) { console.error(`  ${rec.slug}: пустое page, пропуск`); continue; }
  // Площадки, записанные объектами в venues.ts, в JSON не дублируем —
  // иначе страница соберётся дважды с одним slug.
  if (!v.blocks) { console.log(`  ${v.slug}: legacy-объект в venues.ts, JSON не пишу`); continue; }
  await mkdir('src/data/venues', { recursive: true });
  await writeFile(join('src/data/venues', `${v.slug}.json`), JSON.stringify(v, null, 2) + '\n');

  const dir = join('src/assets/venues', v.slug);
  await mkdir(dir, { recursive: true });
  let got = 0;
  const index = rec.photoIndex ?? {};
  for (const name of rec.photos ?? []) {
    const ref = index[name];
    if (!ref) { console.error(`  ${v.slug}: ${name} нет в photoIndex — залит мимо pb-seed, пропуск`); continue; }
    const local = ref.slice(`/venues/${v.slug}/`.length);
    const dest = join(dir, local);
    await mkdir(join(dir, local.includes('/') ? local.split('/')[0] : ''), { recursive: true });
    const r = await api.fetch(`/api/files/${rec.collectionId}/${rec.id}/${name}`);
    if (!r.ok) { console.error(`  ${v.slug}/${local}: ${r.status}`); continue; }
    const len = Number(r.headers.get('content-length') ?? 0);
    try { if (len && (await stat(dest)).size === len) { r.body?.cancel(); continue; } } catch {}
    await writeFile(dest, Buffer.from(await r.arrayBuffer()));
    got++;
  }
  console.log(`  ${v.slug}: JSON записан, фото скачано ${got}/${(rec.photos ?? []).length}`);
}

// ---------- подрядчики (зеркало площадок, залиты pb-seed-specialists) ----------
const sp = await api.list('specialists', all ? '' : `filter=${encodeURIComponent('status = "published"')}`);
console.log(`подрядчиков: ${sp.items.length}`);

async function pull(rec, name, dest) {
  const r = await api.fetch(`/api/files/${rec.collectionId}/${rec.id}/${name}`);
  if (!r.ok) { console.error(`  ${dest}: ${r.status}`); return false; }
  const len = Number(r.headers.get('content-length') ?? 0);
  try { if (len && (await stat(dest)).size === len) { r.body?.cancel(); return false; } } catch {}
  await mkdir(join(dest, '..'), { recursive: true });
  await writeFile(dest, Buffer.from(await r.arrayBuffer()));
  return true;
}

for (const rec of sp.items) {
  const s = rec.page;
  if (!s?.slug) { console.error(`  ${rec.slug}: пустое page, пропуск`); continue; }
  const dir = join('src/data/specialists', s.categorySlug);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${s.slug}.json`), JSON.stringify(s, null, 2) + '\n');

  let got = 0;
  const index = rec.photoIndex ?? {};
  const files = [...(rec.photos ?? []), ...(rec.reels ?? []), ...(rec.avatar ? [rec.avatar] : [])];
  for (const name of files) {
    const ref = index[name];
    if (!ref) { console.error(`  ${s.slug}: ${name} нет в photoIndex — залит мимо pb-seed, пропуск`); continue; }
    // фото и аватар — в src/assets (astro:assets пережмёт), ролик — сырым файлом в public
    const dest = ref.startsWith('/reels/') ? join('public', ref) : join('src/assets', ref);
    if (await pull(rec, name, dest)) got++;
  }
  console.log(`  ${s.categorySlug}/${s.slug}: JSON записан, файлов скачано ${got}/${files.length}`);
}
