// Ролики площадки/подрядчика по правилам VIDEO.md — одной командой:
//   node scripts/prep-video.mjs <slug> <out_dir_public> <out_dir_assets> <src1>[@ss] [<src2>[@ss] ...]
// Пример:
//   node scripts/prep-video.mjs due-to-love public/venues/due-to-love src/assets/venues/due-to-love research/due-to-love/raw2/IMG_0527.mov@1
// Каждый исходник → reel-NN.mp4 (720×1080, кадр 2:3 под первый экран, 8 с,
// H.264 main, crf 30, звук aac 96k если есть) в public/ и постер reel-NN.webp
// (первый кадр) в src/assets/. Горизонтальный исходник кропится по центру.
// «@ss» — с какой секунды резать (по умолчанию 0.5). Нумерация продолжает
// уже лежащие в public reel-NN. В конце печатает готовые пути для JSON.
import { mkdir, readdir, stat } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { execFileSync } from 'node:child_process';

const [slug, pubDir, assetsDir, ...srcs] = process.argv.slice(2);
if (!slug || !pubDir || !assetsDir || !srcs.length) {
  console.error('usage: node scripts/prep-video.mjs <slug> <public_dir> <assets_dir> <src[@ss]> ...');
  process.exit(1);
}
await mkdir(pubDir, { recursive: true });
await mkdir(assetsDir, { recursive: true });

const existing = (await readdir(pubDir)).filter((f) => /^reel-\d+\.mp4$/.test(f)).length;
let n = existing;
const done = [];
const quiet = (args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: ['ignore', 'ignore', 'pipe'] });

for (const item of srcs) {
  const [src, ssRaw] = item.split('@');
  const ss = ssRaw ?? '0.5';
  n++;
  const id = `reel-${String(n).padStart(2, '0')}`;
  const mp4 = join(pubDir, `${id}.mp4`);
  const webp = join(assetsDir, `${id}.webp`);
  const hasAudio = (() => {
    try { return execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=codec_name', '-of', 'csv=p=0', src]).toString().trim().length > 0; } catch { return false; }
  })();
  try {
    quiet([
      '-ss', ss, '-t', '8', '-i', src,
      '-vf', 'scale=720:1280:force_original_aspect_ratio=increase,crop=720:1080,fps=30',
      '-c:v', 'libx264', '-profile:v', 'main', '-crf', '30', '-preset', 'slow', '-pix_fmt', 'yuv420p',
      ...(hasAudio ? ['-c:a', 'aac', '-b:a', '96k'] : ['-an']),
      '-movflags', '+faststart', mp4,
    ]);
    quiet(['-i', mp4, '-frames:v', '1', '-c:v', 'libwebp', '-quality', '82', webp]);
    const kb = Math.round((await stat(mp4)).size / 1024);
    done.push({ id, src: basename(src), kb, sound: hasAudio });
    console.log(`${id}  ${kb} KB  ${hasAudio ? 'звук' : 'немой'}  <- ${basename(src)}`);
  } catch (e) {
    const msg = (e.stderr?.toString() ?? e.message).split('\n').filter((l) => !/hevc|POC|RPS|allocate|repeated/.test(l)).slice(0, 3).join(' | ');
    console.error(`FAIL ${id} <- ${basename(src)}: ${msg}`);
    n--;
  }
}

const base = pubDir.replace(/^public/, '').replace(/\\/g, '/');
console.log('\nВ JSON (gallery / photos):');
for (const d of done) console.log(`  { "src": "${base}/${d.id}.mp4", "alt": "…" }`);
console.log('\nВ data/reels.ts (звук): ' + done.filter((d) => d.sound).map((d) => `${base}/${d.id}.mp4`).join(', '));
