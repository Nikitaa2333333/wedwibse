// Заливает подрядчиков в PocketBase (upsert по categorySlug+slug):
//   node scripts/pb-seed-specialists.mjs [slug ...] [--publish] [--refresh-reels]
// Зеркало pb-seed.mjs для площадок. Источник — src/data/specialists/<кат>/<slug>.json
// (конвейер specialist-page); демо-подрядчики из specialists.ts в базу
// не идут. Файлы записи: photos — галерея и портрет из
// src/assets/specialists/<кат>/<slug>/, avatar — …/avatars/<slug>.webp,
// reels — ролики автора из data/reels.ts (public/reels/*.mp4 + постер).
// Соответствие «имя в PB → исходный путь» — в photoIndex (PB переименовывает
// файлы), по нему pb-pull восстанавливает src/. Уже залитое не повторяется.
// Плоские колонки под фильтры каталога — priceFrom и карта filters из JSON,
// бакеты считать не нужно: у подрядчика они уже заданы руками.
// Статус новой записи draft; --publish ставит published.
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { loadEnv, pb } from './pb-lib.mjs';

const argv = process.argv.slice(2);
const publish = argv.includes('--publish');
const refreshReels = argv.includes('--refresh-reels');
const only = argv.filter((a) => !a.startsWith('--'));

const api = await pb(await loadEnv());

// ---------- источники ----------
const specialists = [];
for (const cat of await readdir('src/data/specialists').catch(() => [])) {
  for (const f of await readdir(join('src/data/specialists', cat)).catch(() => [])) {
    if (f.endsWith('.json')) specialists.push(JSON.parse(await readFile(join('src/data/specialists', cat, f), 'utf8')));
  }
}
const todo = only.length ? specialists.filter((s) => only.includes(s.slug)) : specialists;
console.log(`подрядчиков к заливке: ${todo.length}`);

// ролики автора — из data/reels.ts без сборки: файл чистый TS, читаем регуляркой
const reelsSrc = await readFile('src/data/reels.ts', 'utf8').catch(() => '');
function reelsOf(slug) {
  const out = [];
  for (const m of reelsSrc.matchAll(/src:\s*'([^']+)'[^}]*author:\s*'([^']*)'/g)) if (m[2] === slug) out.push(m[1]);
  return out;
}

const mime = (f) => (f.endsWith('.mp4') ? 'video/mp4' : f.endsWith('.jpg') ? 'image/jpeg' : 'image/webp');

// ---------- upsert ----------
for (const s of todo) {
  const existing = await api.first('specialists', `categorySlug = "${s.categorySlug}" && slug = "${s.slug}"`);
  const data = {
    slug: s.slug, categorySlug: s.categorySlug, alsoCategories: s.alsoCategories ?? [],
    name: s.name, tagline: s.tagline ?? '', citySlug: 'moskva',
    priceFrom: s.priceFrom ?? null, filters: s.filters ?? {}, page: s,
    source: s.source ?? '',
  };
  if (!existing) data.status = publish ? 'published' : 'draft';
  else if (publish) data.status = 'published';
  const rec = existing ? await api.update('specialists', existing.id, data) : await api.create('specialists', data);

  // что заливать: галерея + портрет (photos), аватар (avatar), ролики (reels)
  const prefix = `/specialists/${s.categorySlug}/`;
  const refs = [...new Set(JSON.stringify(s).match(new RegExp(`${prefix}[\\w./-]+\\.(webp|jpg)`, 'g')) ?? [])];
  const reels = reelsOf(s.slug);
  // --refresh-reels: ролики перегнали тем же именем (24.09 — лупы 8 с → до 60 с),
  // а заливка пропускает всё, что уже в индексе. Снимаем старые файлы роликов
  // с записи, дальше обычный путь зальёт текущие.
  if (refreshReels && rec.reels?.length) {
    Object.assign(rec, await api.update('specialists', rec.id, { 'reels-': rec.reels }));
  }
  const index = { ...(rec.photoIndex ?? {}) };
  const present = new Set([...(rec.photos ?? []), ...(rec.reels ?? []), ...(rec.avatar ? [rec.avatar] : [])]);
  for (const k of Object.keys(index)) if (!present.has(k)) delete index[k]; // файл удалили в админке
  const have = new Set(Object.values(index));

  const form = new FormData();
  const queued = { photos: [], reels: [], avatar: null };
  for (const ref of refs) {
    if (have.has(ref)) continue;
    const isAvatar = ref.includes('/avatars/');
    const local = join('src/assets', ref);
    try {
      const buf = await readFile(local);
      const name = ref.slice(prefix.length).replace(/\//g, '_');
      if (isAvatar) { form.append('avatar', new Blob([buf], { type: mime(ref) }), name); queued.avatar = ref; }
      else { form.append('photos+', new Blob([buf], { type: mime(ref) }), name); queued.photos.push(ref); }
    } catch { console.error(`  нет файла ${local}`); }
  }
  for (const ref of reels) {
    if (have.has(ref)) continue;
    try {
      const buf = await readFile(join('public', ref));
      form.append('reels+', new Blob([buf], { type: 'video/mp4' }), ref.split('/').pop());
      queued.reels.push(ref);
    } catch { console.error(`  нет ролика public${ref}`); }
  }

  const total = queued.photos.length + queued.reels.length + (queued.avatar ? 1 : 0);
  if (total) {
    const before = { photos: rec.photos ?? [], reels: rec.reels ?? [] };
    const after = await api.update('specialists', rec.id, form);
    // PB дописывает новые файлы в конец в порядке загрузки
    const freshPhotos = after.photos.filter((n) => !before.photos.includes(n));
    const freshReels = (after.reels ?? []).filter((n) => !before.reels.includes(n));
    if (freshPhotos.length !== queued.photos.length || freshReels.length !== queued.reels.length) {
      console.error(`  ${s.slug}: залито ${freshPhotos.length}+${freshReels.length}, ожидалось ${queued.photos.length}+${queued.reels.length} — индекс может разойтись`);
    }
    freshPhotos.forEach((n, i) => { if (queued.photos[i]) index[n] = queued.photos[i]; });
    freshReels.forEach((n, i) => { if (queued.reels[i]) index[n] = queued.reels[i]; });
    if (queued.avatar && after.avatar) index[after.avatar] = queued.avatar;
    await api.update('specialists', rec.id, { photoIndex: index });
  }
  console.log(`${existing ? '↻' : '+'} ${s.categorySlug}/${s.slug}: фото +${queued.photos.length}, ролики +${queued.reels.length}${queued.avatar ? ', аватар' : ''} (в индексе ${Object.keys(index).length})`);
}
