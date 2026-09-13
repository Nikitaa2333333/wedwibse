// Скачивает публичную папку Яндекс.Диска целиком (рекурсивно) без токена.
// Использование: node scripts/fetch-yadisk.mjs <public_url> <out_dir> [--only=video|photo]
// Картинки и видео кладутся плоско в out_dir с префиксом подпапки
// (подпапки обходятся рекурсивно: «ВИДЕО ЛЕСНАЯ РОСА» внутри выборки
// попадает как ВИДЕО_ЛЕСНАЯ_РОСА__IMG_0311.mov). --only фильтрует по типу.
// Часть конвейера venue-page (см. .claude/skills/venue-page/SKILL.md).
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const [publicUrl, outDir, ...flags] = process.argv.slice(2);
const only = flags.find((f) => f.startsWith('--only='))?.slice(7);
if (!publicUrl || !outDir) {
  console.error('usage: node scripts/fetch-yadisk.mjs <public_url> <out_dir>');
  process.exit(1);
}
const API = 'https://cloud-api.yandex.net/v1/disk/public/resources';
const KEEP = /\.(jpe?g|png|webp|heic|mp4|mov)$/i;

// cloud-api.yandex.net временами не отвечает на первый коннект — повторяем.
async function get(url, tries = 5) {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(180_000) });
      if (r.ok) return r;
      if (i >= tries) throw new Error(`${r.status} ${await r.text()}`);
    } catch (e) {
      if (i >= tries) throw e;
      console.error(`retry ${i}: ${e.cause?.code ?? e.message}`);
    }
    await new Promise((res) => setTimeout(res, 3000 * i));
  }
}

async function list(path = '') {
  const items = [];
  for (let offset = 0; ; offset += 200) {
    const u = `${API}?public_key=${encodeURIComponent(publicUrl)}&limit=200&offset=${offset}${path ? `&path=${encodeURIComponent(path)}` : ''}`;
    const r = await get(u);
    const d = await r.json();
    const emb = d._embedded;
    if (!emb) return [{ ...d, _path: path }];
    for (const it of emb.items) {
      if (it.type === 'dir') items.push(...(await list(it.path)));
      else items.push({ ...it, _path: path });
    }
    if (offset + 200 >= emb.total) break;
  }
  return items;
}

await mkdir(outDir, { recursive: true });
const TYPE = { video: /\.(mp4|mov)$/i, photo: /\.(jpe?g|png|webp|heic)$/i };
const items = (await list()).filter((i) => KEEP.test(i.name) && (!only || TYPE[only]?.test(i.name)));
console.log(`files: ${items.length}`);
let n = 0;
for (const it of items) {
  const prefix = it._path ? it._path.replace(/^\/+/, '').replace(/[\\/]+/g, '_') + '__' : '';
  const dest = join(outDir, prefix + it.name);
  try {
    const s = await stat(dest);
    if (s.size === it.size) { n++; continue; }
  } catch {}
  let r;
  try { r = await get(it.file); } catch (e) { console.error(`skip ${it.name}: ${e.message}`); continue; }
  await writeFile(dest, Buffer.from(await r.arrayBuffer()));
  n++;
  if (n % 10 === 0) console.log(`${n}/${items.length}`);
}
console.log(`done: ${n} files -> ${outDir}`);
