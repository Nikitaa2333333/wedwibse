// Перегонка роликов по research/reel-map.json (out ← src с секунды ss), до 60 с.
//   node scripts/reels-reencode.mjs              — все записи карты
//   node scripts/reels-reencode.mjs forest-dew   — только те, где в out есть подстрока
// Запись карты: { out, src, ss, crop?, crf?, poster? } — crop по умолчанию 2:3 центром,
// crf по умолчанию 30 (32 — если минута вышла тяжелее 8 МБ),
// poster: true — заодно вырезать постер 1080×1620 из исходника на той же секунде.
// Сама карта лежит в research/ (в .gitignore, как и исходники), см. VIDEO.md.
import { spawnSync } from 'node:child_process';
import { readFileSync, renameSync, statSync } from 'node:fs';

const MAP = 'research/reel-map.json';
const CENTER = "crop='min(iw,ih*2/3)':'min(ih,iw*3/2)'";
const only = process.argv[2];
const rows = JSON.parse(readFileSync(MAP, 'utf8')).filter((r) => !only || r.out.includes(only));

for (const r of rows) {
  const crop = r.crop ?? CENTER;
  const tmp = r.out.replace(/\.mp4$/, '.tmp.mp4');
  const res = spawnSync('ffmpeg', [
    '-v', 'error', '-y', '-ss', String(r.ss), '-t', '60', '-i', r.src,
    '-map', '0:v:0', '-map', '0:a:0?',
    '-vf', `${crop},scale=720:1080,fps=30`,
    '-c:v', 'libx264', '-profile:v', 'main', '-crf', String(r.crf ?? 30), '-preset', 'medium', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', tmp,
  ]);
  if (res.status !== 0) { console.log(`× ${r.out}: ${res.stderr.toString().trim().split('\n').pop()}`); continue; }
  renameSync(tmp, r.out);

  if (r.poster) {
    const poster = r.out.replace(/^public/, 'src/assets').replace(/\.mp4$/, '.webp');
    spawnSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(r.ss), '-i', r.src, '-frames:v', '1',
      '-vf', `${crop},scale=1080:1620`, '-c:v', 'libwebp', '-quality', '88', poster]);
  }
  const d = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', r.out]).stdout.toString().trim();
  console.log(`✓ ${r.out}  ${(+d).toFixed(1)} с  ${(statSync(r.out).size / 1048576).toFixed(1)} МБ`);
}
