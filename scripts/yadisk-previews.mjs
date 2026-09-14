// Контактный лист публичной папки Яндекс.Диска БЕЗ скачивания оригиналов:
//   node --dns-result-order=ipv6first scripts/yadisk-previews.mjs <slug> <public_url> [paths.json]
// Листает папку (или подпапки из paths.json — массив путей вида "/Фото";
// кириллицу через argv Git Bash ломает, поэтому файл), качает превью 600px
// в research/specialists/<slug>/prev/NNN.jpg, пишет prev/index.tsv
// (номер · путь на диске · размер) и собирает research/_sheets/<slug>.jpg.
// Дальше оркестратор смотрит лист одним Read и отбирает номера для
// yadisk-pick.mjs. Часть конвейера specialist-page.
import { writeFile, mkdir, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const [slug, publicUrl, pathsFile] = process.argv.slice(2);
if (!slug || !publicUrl) { console.error('usage: node scripts/yadisk-previews.mjs <slug> <public_url> [paths.json]'); process.exit(1); }
const API = 'https://cloud-api.yandex.net/v1/disk/public/resources';
const IMG = /\.(jpe?g|png|webp|heic)$/i;

// cloud-api.yandex.net временами не отвечает на первый коннект — повторяем.
async function get(url, tries = 12) {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      if (r.ok) return r;
      if (i >= tries) throw new Error(`${r.status} ${await r.text()}`);
    } catch (e) { if (i >= tries) throw e; }
    await new Promise((res) => setTimeout(res, 2000 * i));
  }
}

const base = join('research', 'specialists', slug);
const out = join(base, 'prev');
await mkdir(out, { recursive: true });
const paths = pathsFile ? JSON.parse(await readFile(pathsFile, 'utf8')) : [''];

// корень: имя папки — часто и есть название подрядчика (см. скилл)
const root = await (await get(`${API}?public_key=${encodeURIComponent(publicUrl)}&limit=1`)).json();
console.log(`папка: «${root.name}»`);

let n = 0;
const index = [];
for (const path of paths) {
  for (let offset = 0; ; offset += 200) {
    const u = `${API}?public_key=${encodeURIComponent(publicUrl)}&limit=200&offset=${offset}&preview_size=600x${path ? `&path=${encodeURIComponent(path)}` : ''}`;
    const d = await (await get(u)).json();
    const emb = d._embedded;
    if (!emb) break;
    for (const it of emb.items) {
      if (it.type !== 'file' || !IMG.test(it.name) || !it.preview) continue;
      const f = await get(it.preview);
      const id = String(n).padStart(3, '0');
      await writeFile(join(out, `${id}.jpg`), Buffer.from(await f.arrayBuffer()));
      index.push(`${id}\t${it.path}\t${it.size}`);
      n++;
    }
    if (offset + 200 >= emb.total) break;
  }
}
await writeFile(join(out, 'index.tsv'), index.join('\n'));
console.log(`превью: ${n}`);

await mkdir('research/_sheets', { recursive: true });
const sheet = join('research', '_sheets', `${slug}.jpg`);
const files = (await readdir(out)).filter((f) => f.endsWith('.jpg')).sort().map((f) => join(out, f));
execFileSync('magick', ['montage', ...files, '-thumbnail', '200x200', '-set', 'label', '%t', '-tile', '10x', '-geometry', '+4+4', '-pointsize', '14', sheet]);
execFileSync('magick', [sheet, '-resize', '1800x', sheet]);
console.log(`лист: ${sheet}`);
