// Пережатие кадров НА СЕРВЕРЕ (VPS) — та же работа, что prep-photos.mjs на
// ноутбуке, но на sharp вместо magick и прямо там, куда диск уже скачан.
// Зачем: тянуть на ноутбук через VPN сырые оригиналы (45 кадров ≈ 400 МБ —
// 4 минуты) дольше, чем готовые webp (в 5–10 раз легче). Ставится и
// запускается из research.sh pick, руками не вызывается.
//
//   node prep-photos-server.mjs <out/slug>    raw/* → photos/pNN.webp + photos.json
//
// Манифест — тот же формат, что у prep-photos.mjs (id, file, source, width,
// height, ratio, orientation, kb, broken), поэтому place-* и verify-* не
// замечают, где именно кадры пережимали. source пишется локальным путём
// research/specialists/<slug>/raw/<файл> — как если бы прогон шёл на ноутбуке.
//
// Сервер общий с сайтом (2 ГБ RAM): по одному кадру, без кэша sharp,
// а сам вызов из research.sh идёт под nice -n 19.
import sharp from 'sharp';
import { readdir, mkdir, stat, writeFile } from 'node:fs/promises';
import { join, basename } from 'node:path';

sharp.concurrency(1);
sharp.cache(false);

const base = process.argv[2];
if (!base) { console.error('usage: node prep-photos-server.mjs <out/slug>'); process.exit(1); }
const slug = basename(base);
const rawDir = join(base, 'raw');
const outDir = join(base, 'photos');
await mkdir(outDir, { recursive: true });

const files = (await readdir(rawDir)).filter((f) => /\.(jpe?g|png|webp|heic|tiff?)$/i.test(f)).sort();
const manifest = [];
let i = 0;
for (const f of files) {
  i++;
  const id = `p${String(i).padStart(2, '0')}`;
  const src = join(rawDir, f);
  const dest = join(outDir, `${id}.webp`);
  const source = `research/specialists/${slug}/raw/${f}`;
  let ok = false;
  for (let t = 0; t < 3 && !ok; t++) {
    try {
      // rotate() без аргумента — ориентация по EXIF, длинная сторона до 2800, без апскейла
      await sharp(src, { failOn: 'error' })
        .rotate()
        .resize({ width: 2800, height: 2800, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 88 })
        .toFile(dest);
      // полное декодирование результата: недописанный webp заголовком не ловится
      await sharp(dest, { failOn: 'error' }).raw().toBuffer();
      ok = true;
    } catch (e) {
      if (t === 2) console.error(`BROKEN ${f}: ${e.message}`);
    }
  }
  if (!ok) { manifest.push({ id, file: null, source, broken: true }); continue; }
  const { width: w, height: h } = await sharp(dest).metadata();
  const ratio = w / h;
  manifest.push({
    id, file: `${id}.webp`, source, width: w, height: h,
    ratio: Number(ratio.toFixed(3)),
    // граница вертикальности — та же, что в prep-photos.mjs и lib/media.ts
    orientation: ratio < 0.95 ? 'portrait' : ratio > 1.05 ? 'landscape' : 'square',
    kb: Math.round((await stat(dest)).size / 1024),
  });
  if (i % 10 === 0) console.log(`${i}/${files.length}`);
}
await writeFile(join(base, 'photos.json'), JSON.stringify(manifest, null, 2));
const good = manifest.filter((m) => !m.broken);
const by = (o) => good.filter((m) => m.orientation === o).length;
console.log(`done: ${good.length} ok, ${manifest.length - good.length} broken; portrait ${by('portrait')}, landscape ${by('landscape')}, square ${by('square')}`);
