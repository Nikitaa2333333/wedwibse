// Видео с публичного Яндекс.Диска — только листинг и точечное скачивание:
//   node --dns-result-order=ipv6first scripts/yadisk-video.mjs <slug> <public_url> list
//   node --dns-result-order=ipv6first scripts/yadisk-video.mjs <slug> <public_url> get <paths.json>
// list — все .mp4/.mov по папке рекурсивно (путь, МБ). get — качает пути
// из JSON-массива в research/specialists/<slug>/video/ (кириллица через
// argv Git Bash ломается, поэтому файл). Гигабайтные исходники не брать:
// в карточку идёт 8-секундный луп, хватает 2–3 лёгких файлов — см. VIDEO.md.
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const [slug, publicUrl, cmd, pathsFile] = process.argv.slice(2);
if (!slug || !publicUrl || !cmd) { console.error('usage: node scripts/yadisk-video.mjs <slug> <public_url> list | get <paths.json>'); process.exit(1); }
const API = 'https://cloud-api.yandex.net/v1/disk/public/resources';
const VID = /\.(mp4|mov)$/i;

async function get(url, tries = 12) {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(600_000) });
      if (r.ok) return r;
      if (i >= tries) throw new Error(`${r.status} ${await r.text()}`);
    } catch (e) { if (i >= tries) throw e; }
    await new Promise((res) => setTimeout(res, 2000 * i));
  }
}

if (cmd === 'list') {
  async function walk(path = '') {
    for (let offset = 0; ; offset += 200) {
      const d = await (await get(`${API}?public_key=${encodeURIComponent(publicUrl)}&limit=200&offset=${offset}${path ? `&path=${encodeURIComponent(path)}` : ''}`)).json();
      const emb = d._embedded;
      if (!emb) return;
      for (const it of emb.items) {
        if (it.type === 'dir') await walk(it.path);
        else if (VID.test(it.name)) console.log(`${JSON.stringify(it.path)}\t${(it.size / 1e6).toFixed(0)} МБ`);
      }
      if (offset + 200 >= emb.total) return;
    }
  }
  await walk();
} else {
  const out = join('research', 'specialists', slug, 'video');
  await mkdir(out, { recursive: true });
  for (const path of JSON.parse(await readFile(pathsFile, 'utf8'))) {
    const { href } = await (await get(`${API}/download?public_key=${encodeURIComponent(publicUrl)}&path=${encodeURIComponent(path)}`)).json();
    const f = await get(href);
    // имя без пробелов и пунктуации, чтобы ffmpeg и bash не спотыкались
    const name = path.split('/').pop().replace(/[^\w.а-яё-]+/gi, '_');
    await writeFile(join(out, name), Buffer.from(await f.arrayBuffer()));
    console.log(`ok ${name}`);
  }
}
