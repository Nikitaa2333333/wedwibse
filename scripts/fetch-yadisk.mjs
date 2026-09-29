// Публичный Яндекс.Диск без токена — один инструмент на все выгрузки.
//
//   node scripts/fetch-yadisk.mjs <url> <out>                     всё подряд, рекурсивно
//   node scripts/fetch-yadisk.mjs <url> <out> --only=video        только ролики
//   node scripts/fetch-yadisk.mjs <url> <out> --mode=list         показать, не качать
//   node scripts/fetch-yadisk.mjs <url> <out> --mode=preview      превью 600px в <out>/prev + index.tsv
//   node scripts/fetch-yadisk.mjs <url> <out> --pick="004 005"    оригиналы по номерам из index.tsv в <out>/raw
//
// Общее: --jobs=N (параллельных загрузок, по умолчанию 6), --path=/подпапка.
//
// Заменяет разовые скрипты в research/ (_prev/_pick/_vid и их копии по
// подрядчикам). research/ в .gitignore — те скрипты жили только на ноутбуке;
// этот лежит в git, поэтому доступен и на VPS, и в облачной сессии.
// Часть конвейера venue-page (см. .claude/skills/venue-page/SKILL.md) —
// вызов `<url> <out> [--only=]` работает ровно как раньше.
import { mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';

const [publicUrl, outDir, ...flags] = process.argv.slice(2);
const flag = (name, def) => flags.find((f) => f.startsWith(`--${name}=`))?.slice(name.length + 3) ?? def;
const only = flag('only');
const mode = flag('mode', 'all');
const pick = flag('pick');
const root = flag('path', '');
const jobs = Math.max(1, Number(flag('jobs', 6)) || 6);

if (!publicUrl || !outDir) {
  console.error('usage: node scripts/fetch-yadisk.mjs <public_url> <out_dir> [--mode=list|preview] [--pick="004 005"] [--only=photo|video] [--jobs=6] [--path=/sub]');
  process.exit(1);
}

const API = 'https://cloud-api.yandex.net/v1/disk/public/resources';
const KEEP = /\.(jpe?g|png|webp|heic|mp4|mov)$/i;
const TYPE = { video: /\.(mp4|mov)$/i, photo: /\.(jpe?g|png|webp|heic)$/i };

// cloud-api.yandex.net временами не отвечает на первый коннект — повторяем.
// Таймаут щедрый: оригиналы бывают по сотне мегабайт.
async function get(url, tries = 5) {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(180_000) });
      if (r.ok) return r;
      const err = new Error(`${r.status} ${await r.text()}`);
      // 4xx кроме 429 — приговор, а не помеха: мёртвая ссылка или закрытый
      // доступ повтором не лечится, а пять заходов по нарастающей съедают
      // полминуты на каждом файле. Помечаем, чтобы catch ниже не повторял.
      err.permanent = r.status >= 400 && r.status < 500 && r.status !== 429;
      throw err;
    } catch (e) {
      if (e.permanent || i >= tries) throw e;
      console.error(`  retry ${i}: ${e.cause?.code ?? e.message}`);
    }
    await new Promise((res) => setTimeout(res, 3000 * i));
  }
}

// Параллельность — главный рычаг скорости. Каждый файл это отдельный
// round-trip к API плюс загрузка; последовательно канал простаивает
// между запросами. 6 потоков Диск держит спокойно, выше — начинает
// отдавать 429.
async function pool(items, fn) {
  let next = 0;
  let done = 0;
  await Promise.all(
    Array.from({ length: Math.min(jobs, items.length) }, async () => {
      while (next < items.length) {
        const it = items[next++];
        try {
          await fn(it);
        } catch (e) {
          console.error(`  × ${it.name ?? it}: ${e.message}`);
        }
        if (++done % 10 === 0 || done === items.length) console.log(`  ${done}/${items.length}`);
      }
    }),
  );
}

// Обход папки целиком: Диск отдаёт по 200 записей, вложенные папки
// раскрываем рекурсивно. preview_size просим сразу — в режиме preview
// ссылка на миниатюру приходит тем же ответом, лишнего запроса нет.
async function list(path = '') {
  const items = [];
  for (let offset = 0; ; offset += 200) {
    const u = `${API}?public_key=${encodeURIComponent(publicUrl)}&limit=200&offset=${offset}&preview_size=600x${path ? `&path=${encodeURIComponent(path)}` : ''}`;
    const d = await (await get(u)).json();
    const emb = d._embedded;
    if (!emb) return [{ ...d, _path: path }];
    for (const it of emb.items) {
      if (it.type === 'dir') items.push(...(await list(it.path)));
      else items.push({ ...it, _path: path });
    }
    if (offset + 200 >= emb.total) break;
  }
  return items;
}

// Докачка: файл того же размера второй раз не тянем. Пишем во временный
// .part и переименовываем — оборванная загрузка не встанет на место
// готовым файлом (та же защита, что в media-push.sh).
async function save(url, dest, size) {
  if (size != null) {
    try {
      if ((await stat(dest)).size === size) return false;
    } catch {}
  }
  await mkdir(dirname(dest), { recursive: true });
  const buf = Buffer.from(await (await get(url)).arrayBuffer());
  await writeFile(`${dest}.part`, buf);
  const { rename } = await import('node:fs/promises');
  await rename(`${dest}.part`, dest);
  return true;
}

const num = (n) => String(n).padStart(3, '0');

// ── режим pick: оригиналы отобранных кадров ────────────────────────────
// Номера берём из index.tsv, который оставил режим preview.
if (pick) {
  const tsv = await readFile(join(outDir, 'prev', 'index.tsv'), 'utf8');
  const idx = Object.fromEntries(tsv.trim().split('\n').map((l) => l.split('\t')));
  const wanted = pick.split(/\s+/).filter(Boolean);
  console.log(`оригиналов к загрузке: ${wanted.length}`);
  await pool(wanted, async (n) => {
    const path = idx[n];
    if (!path) throw new Error('нет такого номера в index.tsv');
    const { href } = await (await get(`${API}/download?public_key=${encodeURIComponent(publicUrl)}&path=${encodeURIComponent(path)}`)).json();
    await save(href, join(outDir, 'raw', `${n}.${path.replace(/.*\./, '')}`));
  });
  console.log(`готово -> ${join(outDir, 'raw')}`);
  process.exit(0);
}

// ── общий листинг ──────────────────────────────────────────────────────
const items = (await list(root)).filter((i) => KEEP.test(i.name) && (!only || TYPE[only]?.test(i.name)));
console.log(`files: ${items.length}`);

// ── режим list: только показать, что есть ──────────────────────────────
if (mode === 'list') {
  for (const it of items) console.log(`${(it.size / 1e6).toFixed(1).padStart(7)} MB  ${it.path}`);
  const total = items.reduce((s, i) => s + i.size, 0);
  console.log(`итого: ${items.length} файлов, ${(total / 1e9).toFixed(2)} ГБ`);
  process.exit(0);
}

// ── режим preview: контактный лист для отбора ──────────────────────────
// Миниатюры 600px + index.tsv «номер → путь на Диске». Дальше смотришь
// папку глазами и передаёшь номера в --pick.
if (mode === 'preview') {
  const photos = items.filter((i) => TYPE.photo.test(i.name) && i.preview);
  const dir = join(outDir, 'prev');
  console.log(`превью: ${photos.length}`);
  await pool(
    photos.map((it, i) => ({ ...it, _n: num(i) })),
    (it) => save(it.preview, join(dir, `${it._n}.jpg`)),
  );
  await writeFile(join(dir, 'index.tsv'), photos.map((it, i) => `${num(i)}\t${it.path}\t${it.size}`).join('\n'));
  console.log(`готово -> ${dir} (index.tsv на ${photos.length} кадров)`);
  process.exit(0);
}

// ── режим all: выкачать папку целиком ──────────────────────────────────
// Плоско, с префиксом подпапки: «ВИДЕО ЛЕСНАЯ РОСА/IMG_0311.mov» ляжет
// как ВИДЕО_ЛЕСНАЯ_РОСА__IMG_0311.mov.
await mkdir(outDir, { recursive: true });
let fresh = 0;
await pool(items, async (it) => {
  const prefix = it._path ? it._path.replace(/^\/+/, '').replace(/[\/]+/g, '_') + '__' : '';
  if (await save(it.file, join(outDir, prefix + it.name), it.size)) fresh++;
});
console.log(`done: ${items.length} files (${fresh} новых) -> ${outDir}`);
