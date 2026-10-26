// Карточки подрядчиков из кабинета → сборка сайта (только на раннере деплоя):
//   PB_PUBLIC_URL=https://wed-secrets.ru node scripts/pb-pull-cabinet.mjs
//
// Одобренная модератором карточка живёт в базе (specialists, source =
// «кабинет», page.source = 'cabinet'). Пока сервер не собирает страницы
// из базы сам (STAGE2.md, недели 3–5), её выводит на сайт обычная сборка:
// этот скрипт перед `astro build` кладёт JSON в src/data/cabinet/ и фото
// в src/assets/cabinet/ — обе папки в .gitignore, в git карточки из
// кабинета не попадают (CLAUDE.md: снятая с публикации карточка не должна
// жить в репозитории). Дальше всё как у карточек конвейера: astro:assets
// пережимает фото, визитка и каталог собираются статикой.
//
// Читает только опубликованное — публичным API, без пароля. Нет
// PB_PUBLIC_URL или база не отвечает — сайт собирается без этих карточек.
// Площадки из кабинета (страница из блоков) — следующим шагом, BACKLOG.md.
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const BASE = (process.env.PB_PUBLIC_URL || '').replace(/\/$/, '');
if (!BASE) { console.log('pb-pull-cabinet: PB_PUBLIC_URL не задан, пропускаю'); process.exit(0); }

const DATA = 'src/data/cabinet/specialists';
const ASSETS = 'src/assets/cabinet';
// каждый раз с нуля: снятая с публикации карточка должна исчезнуть с сайта
await rm(DATA, { recursive: true, force: true });
await rm(ASSETS, { recursive: true, force: true });

const filter = encodeURIComponent('status = "published" && source = "кабинет"');
const items = [];
try {
  for (let page = 1; ; page++) {
    const r = await fetch(`${BASE}/api/collections/specialists/records?perPage=200&page=${page}&filter=${filter}`, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
    const res = await r.json();
    items.push(...res.items);
    if (page >= res.totalPages) break;
  }
} catch (err) {
  console.log(`pb-pull-cabinet: база не ответила (${err.message}) — собираю без карточек из кабинета`);
  process.exit(0);
}

/** файл карточки; сбой сети по одному кадру не роняет деплой — кадр пропускается */
async function download(url, dest) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (!r.ok) throw new Error(String(r.status));
    await writeFile(dest, Buffer.from(await r.arrayBuffer()));
    return true;
  } catch (err) {
    console.error(`  ${dest}: ${err.message}`);
    return false;
  }
}

await mkdir(DATA, { recursive: true });
let written = 0;
for (const rec of items) {
  const p = rec.page ?? {};
  if (p.source !== 'cabinet' || !rec.slug || !rec.categorySlug) continue;
  const dir = join(ASSETS, rec.categorySlug, rec.slug);
  await mkdir(dir, { recursive: true });
  // обложка — первым кадром: [0] — главный кадр карточки
  const names = [...(p.photos ?? rec.photos ?? [])];
  const cover = names.splice(p.cover ?? 0, 1);
  const photos = [];
  for (const [i, name] of [...cover, ...names].entries()) {
    const ext = (name.match(/\.(webp|jpe?g|png)$/i)?.[1] ?? 'jpg').toLowerCase();
    const file = `p${String(i + 1).padStart(2, '0')}.${ext}`;
    if (!(await download(`${BASE}/api/files/${rec.collectionId}/${rec.id}/${encodeURIComponent(name)}`, join(dir, file)))) continue;
    photos.push(`/cabinet/${rec.categorySlug}/${rec.slug}/${file}`);
  }
  if (!photos.length) { console.error(`  ${rec.slug}: нет фото, пропуск`); continue; }
  const card = {
    slug: rec.slug,
    categorySlug: rec.categorySlug,
    category: '', // подпись раздела ставит data/specialists.ts по categorySlug
    name: p.name || rec.name,
    photos,
    tagline: p.tagline ?? '',
    bio: p.about ?? '',
    ...(p.priceFrom ? { priceFrom: p.priceFrom } : {}),
    ...(p.priceNote ? { priceNote: p.priceNote } : {}),
    ...(p.filters && Object.keys(p.filters).length ? { filters: p.filters } : {}),
    // визитка собирается у карточки с текстом (hasProfile): «О себе»
    // подрядчика — разделом story, абзацы по пустой строке
    story: [{ text: String(p.about ?? '').split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean) }],
  };
  await writeFile(join(DATA, `${rec.categorySlug}--${rec.slug}.json`), JSON.stringify(card, null, 2) + '\n');
  written++;
  console.log(`  ${rec.categorySlug}/${rec.slug}: ${photos.length} фото`);
}
console.log(`pb-pull-cabinet: карточек из кабинета ${written} из ${items.length}`);
