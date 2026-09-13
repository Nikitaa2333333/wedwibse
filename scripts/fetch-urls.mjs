// Качает список URL картинок (по одному в строке) в папку — для площадок,
// у которых нет папки с материалами и фото берём с их сайта:
//   node scripts/fetch-urls.mjs <urls.txt> <out_dir>
// Дальше — node scripts/prep-photos.mjs <slug> (он подхватит raw-site/).
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

const [listFile, outDir] = process.argv.slice(2);
if (!listFile || !outDir) { console.error('usage: node scripts/fetch-urls.mjs <urls.txt> <out_dir>'); process.exit(1); }
const urls = [...new Set((await readFile(listFile, 'utf8')).split(/\r?\n/).map((s) => s.trim()).filter((s) => /^https?:\/\//.test(s)))];
await mkdir(outDir, { recursive: true });
let n = 0;
for (const [i, url] of urls.entries()) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(60_000), headers: { 'user-agent': 'Mozilla/5.0' } });
    if (!r.ok) { console.error(`skip ${url}: ${r.status}`); continue; }
    const type = r.headers.get('content-type') ?? '';
    const ext = /webp/.test(type) ? '.webp' : /png/.test(type) ? '.png' : /jpe?g/.test(type) ? '.jpg' : extname(new URL(url).pathname) || '.jpg';
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 30_000) { console.error(`skip ${url}: ${Math.round(buf.length / 1024)} KB — иконка/превью`); continue; }
    await writeFile(join(outDir, `site-${String(i + 1).padStart(3, '0')}${ext}`), buf);
    n++;
  } catch (e) { console.error(`skip ${url}: ${e.message}`); }
}
console.log(`downloaded ${n}/${urls.length} -> ${outDir}`);
