// Переносит кадры, на которые ссылается venue.json, из research/<slug>/photos
// в src/assets/venues/<slug>/ (и og-cover в public/venues/<slug>/):
//   node scripts/place-photos.mjs <slug>
// Читает src/data/venues/<slug>.json, собирает все строки вида
// /venues/<slug>/<file>.webp, копирует только их. Кадры, которые в JSON
// не попали, в репозиторий не едут — лишние мегабайты в сборке не нужны.
import { readFile, mkdir, copyFile, access } from 'node:fs/promises';
import { join } from 'node:path';

const slug = process.argv[2];
if (!slug) { console.error('usage: node scripts/place-photos.mjs <slug>'); process.exit(1); }

const json = await readFile(join('src', 'data', 'venues', `${slug}.json`), 'utf8');
const refs = new Set(json.match(new RegExp(`/venues/${slug}/[\\w./-]+\\.(webp|jpg)`, 'g')) ?? []);
const srcDir = join('research', slug, 'photos');
const assetsDir = join('src', 'assets', 'venues', slug);
const publicDir = join('public', 'venues', slug);
await mkdir(assetsDir, { recursive: true });
await mkdir(publicDir, { recursive: true });

let missing = 0;
for (const ref of refs) {
  const file = ref.slice(`/venues/${slug}/`.length);
  const from = join(srcDir, file);
  try { await access(from); } catch { console.error(`MISSING ${from}`); missing++; continue; }
  await copyFile(from, join(assetsDir, file));
  // og-cover нужен и сырым URL для соцсетей (Layout собирает og:image через new URL)
  if (file.startsWith('og-cover')) await copyFile(from, join(publicDir, file));
}
console.log(`placed ${refs.size - missing}/${refs.size} -> ${assetsDir}`);
if (missing) process.exit(1);
