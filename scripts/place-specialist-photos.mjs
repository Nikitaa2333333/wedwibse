// Переносит кадры подрядчика из research/specialists/<slug>/photos в src/assets:
//   node scripts/place-specialist-photos.mjs <category> <slug>
// Копирует только то, на что ссылается JSON: галерея →
// src/assets/specialists/<category>/<slug>/gal/, портрет → …/<slug>/portrait.webp,
// аватар (research/specialists/<slug>/avatar.webp) → …/<category>/avatars/<slug>.webp.
import { readFile, mkdir, copyFile, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';

const [category, slug] = process.argv.slice(2);
if (!category || !slug) { console.error('usage: node scripts/place-specialist-photos.mjs <category> <slug>'); process.exit(1); }
const base = join('research', 'specialists', slug);
const json = await readFile(join('src', 'data', 'specialists', category, `${slug}.json`), 'utf8');
const refs = new Set(json.match(/\/specialists\/[\w./-]+\.(webp|jpg|png)/g) ?? []);

let missing = 0, placed = 0;
for (const ref of refs) {
  const rel = ref.replace(/^\/specialists\//, '');
  const dest = join('src', 'assets', 'specialists', rel);
  const file = rel.split('/').pop();
  // откуда: аватар лежит отдельным файлом, остальное — из photos/
  const from = rel.includes('/avatars/') ? join(base, 'avatar.webp') : join(base, 'photos', file);
  try { await access(from); } catch { console.error(`MISSING ${from} (для ${ref})`); missing++; continue; }
  await mkdir(dirname(dest), { recursive: true });
  await copyFile(from, dest);
  placed++;
}
console.log(`placed ${placed}/${refs.size} -> src/assets/specialists/${category}/`);
if (missing) process.exit(1);
