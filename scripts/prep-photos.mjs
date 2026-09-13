// Готовит скачанные фото площадки к укладке в src/assets:
//   node scripts/prep-photos.mjs <slug|research/путь> [raw_dir...]
// Берёт research/<slug>/raw* (или указанные папки); для подрядчиков —
// передать путь целиком: research/specialists/<slug>, пережимает в webp
// по правилу CLAUDE.md (длинная сторона 2400–3000 px, quality 88,
// ориентация по EXIF), проверяет каждый файл magick identify и пишет
// research/<slug>/photos.json: имя, пропорция, portrait/landscape/square,
// размер. По этому манифесту агент выбирает кадры, не глядя на пиксели.
// Результат — research/<slug>/photos/pNN.webp; в src/assets переносит
// уже конвейер по venue.json (scripts/place-photos.mjs).
import { readdir, mkdir, writeFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { execFileSync } from 'node:child_process';

const [slug, ...dirs] = process.argv.slice(2);
if (!slug) { console.error('usage: node scripts/prep-photos.mjs <slug> [raw_dir...]'); process.exit(1); }

const base = slug.includes('/') ? slug : join('research', slug);
const rawDirs = dirs.length ? dirs : (await readdir(base)).filter((d) => d.startsWith('raw')).map((d) => join(base, d));
const outDir = join(base, 'photos');
await mkdir(outDir, { recursive: true });

const IMG = /\.(jpe?g|png|webp|heic)$/i;
const files = [];
for (const d of rawDirs) for (const f of (await readdir(d)).sort()) if (IMG.test(f)) files.push(join(d, f));
console.log(`source files: ${files.length}`);

const manifest = [];
let i = 0;
for (const src of files) {
  i++;
  const id = `p${String(i).padStart(2, '0')}`;
  const dest = join(outDir, `${id}.webp`);
  try {
    // auto-orient по EXIF, длинная сторона до 2800, без апскейла
    execFileSync('magick', [src, '-auto-orient', '-resize', '2800x2800>', '-quality', '88', dest], { stdio: 'pipe' });
    const info = execFileSync('magick', ['identify', '-format', '%w %h', dest], { stdio: 'pipe' }).toString().trim();
    const [w, h] = info.split(' ').map(Number);
    if (!w || !h) throw new Error('identify failed');
    const ratio = w / h;
    const size = (await stat(dest)).size;
    manifest.push({
      id,
      file: `${id}.webp`,
      source: src.replace(/\\/g, '/'),
      width: w,
      height: h,
      ratio: Number(ratio.toFixed(3)),
      // граница вертикальности — та же, что в lib/media.ts (PORTRAIT_MAX_RATIO)
      orientation: ratio < 0.95 ? 'portrait' : ratio > 1.05 ? 'landscape' : 'square',
      kb: Math.round(size / 1024),
    });
  } catch (e) {
    console.error(`BROKEN ${src}: ${e.message.split('\n')[0]}`);
    manifest.push({ id, file: null, source: src, broken: true });
  }
  if (i % 20 === 0) console.log(`${i}/${files.length}`);
}

await writeFile(join(base, 'photos.json'), JSON.stringify(manifest, null, 2));
const ok = manifest.filter((m) => !m.broken);
const by = (o) => ok.filter((m) => m.orientation === o).length;
console.log(`done: ${ok.length} ok, ${manifest.length - ok.length} broken; portrait ${by('portrait')}, landscape ${by('landscape')}, square ${by('square')} -> ${base}/photos.json`);
