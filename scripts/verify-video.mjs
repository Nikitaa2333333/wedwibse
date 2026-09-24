// Проверка всех роликов каталога перед сборкой (без сети и ffmpeg):
//   node scripts/verify-video.mjs
//
// Зачем скрипт, а не глаза: ролик, который не открылся, ведёт себя тихо —
// в кадре просто остаётся постер, и страница выглядит обычной карточкой
// с фотографией. Сборка при этом зелёная (Astro видео не трогает вовсе,
// см. VIDEO.md), так что заметить битый или забытый файл можно только
// пролистав всю ленту на телефоне. С ростом каталога это уже не проверка.
//
// Что проверяем по каждой записи REELS (data/reels.ts):
//   1. сам файл лежит в public/ по своему пути;
//   2. постер лежит в src/assets/ тем же путём с расширением .webp
//      (без него сборка падает на resolveImage — но падает поздно);
//   3. mp4 разбирается: есть moov, видеодорожка, ненулевой размер кадра;
//   4. moov стоит ПЕРЕД mdat (fast start) — иначе браузер не начнёт играть,
//      пока не скачает файл целиком, и автозапуск в ленте «не работает»;
//   5. потолки VIDEO.md: не длиннее 60 с, не выше 720p, не тяжелее 8 МБ;
//   7. один и тот же файл не стоит под двумя записями (у forest-dew так
//      два ролика месяц показывали чужой кадр под своей подписью);
//   6. флаг sound в данных совпадает с реальной звуковой дорожкой в файле:
//      файл со звуком без флага — кнопка звука не появится, флаг без
//      дорожки — кнопка есть, а нажатие ничего не даёт.
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { open } from 'node:fs/promises';

const MAX_SECONDS = 61; // «до 60 с» + запас на округление контейнера
const MAX_HEIGHT = 1080; // вертикаль 720×1080 — это и есть «потолок 720p» по короткой стороне
const MAX_WIDTH = 720;
const MAX_BYTES = 8 * 1024 * 1024;

// ---- разбор mp4 боксов: нам нужны только размеры, длительность и дорожки
async function readBoxes(fh, start, end, onBox) {
  let pos = start;
  while (pos < end) {
    const head = Buffer.alloc(8);
    const { bytesRead } = await fh.read(head, 0, 8, pos);
    if (bytesRead < 8) return;
    let size = head.readUInt32BE(0);
    const type = head.toString('latin1', 4, 8);
    let body = pos + 8;
    if (size === 1) {
      const big = Buffer.alloc(8);
      await fh.read(big, 0, 8, pos + 8);
      size = Number(big.readBigUInt64BE(0));
      body = pos + 16;
    } else if (size === 0) {
      size = end - pos;
    }
    if (size < 8) return;
    await onBox(type, body, pos + size);
    pos += size;
  }
}

async function probe(path) {
  const fh = await open(path, 'r');
  try {
    const { size } = await fh.stat();
    const info = { size, duration: 0, width: 0, height: 0, handlers: [], moovAt: -1, mdatAt: -1 };

    const walk = async (type, body, end) => {
      if (type === 'moov' && info.moovAt < 0) info.moovAt = body;
      if (type === 'mdat' && info.mdatAt < 0) info.mdatAt = body;

      if (type === 'mvhd') {
        const d = Buffer.alloc(end - body);
        await fh.read(d, 0, d.length, body);
        const scale = d[0] === 1 ? d.readUInt32BE(20) : d.readUInt32BE(12);
        const units = d[0] === 1 ? Number(d.readBigUInt64BE(24)) : d.readUInt32BE(16);
        info.duration = scale ? units / scale : 0;
      }
      if (type === 'tkhd') {
        const d = Buffer.alloc(end - body);
        await fh.read(d, 0, d.length, body);
        const w = d.readUInt32BE(d.length - 8) >> 16;
        const h = d.readUInt32BE(d.length - 4) >> 16;
        if (w && h) { info.width = w; info.height = h; }
      }
      if (type === 'hdlr') {
        const d = Buffer.alloc(Math.min(12, end - body));
        await fh.read(d, 0, d.length, body);
        info.handlers.push(d.toString('latin1', 8, 12));
      }
      if (['moov', 'trak', 'mdia', 'minf', 'stbl'].includes(type)) {
        await readBoxes(fh, body, end, walk);
      }
    };

    await readBoxes(fh, 0, size, walk);
    return info;
  } finally {
    await fh.close();
  }
}

// ---- записи роликов читаем прямо из data/reels.ts: второго списка не заводим
const source = await readFile('src/data/reels.ts', 'utf8');
const rows = [...source.matchAll(/\{\s*slug:\s*'([^']+)',\s*src:\s*'([^']+)'[^}]*\}/g)].map((m) => ({
  slug: m[1],
  src: m[2],
  sound: /sound:\s*true/.test(m[0]),
}));

if (rows.length === 0) {
  console.error('не нашли ни одной записи в src/data/reels.ts — изменился формат файла?');
  process.exit(1);
}

const problems = [];
const warnings = [];
const byHash = new Map();

for (const reel of rows) {
  const file = `public${reel.src}`;
  const poster = `src/assets${reel.src.replace(/\.(mp4|webm)$/, '.webp')}`;

  try {
    await stat(file);
  } catch {
    problems.push(`${reel.src}: файла нет в public/`);
    continue;
  }

  try {
    await stat(poster);
  } catch {
    problems.push(`${reel.src}: нет постера ${poster}`);
  }

  const hash = createHash('md5').update(await readFile(file)).digest('hex');
  if (byHash.has(hash)) problems.push(`${reel.src}: тот же файл, что ${byHash.get(hash)} — дубль под чужой подписью`);
  else byHash.set(hash, reel.src);

  let info;
  try {
    info = await probe(file);
  } catch (e) {
    problems.push(`${reel.src}: файл не разбирается как mp4 (${e.message})`);
    continue;
  }

  if (info.moovAt < 0) problems.push(`${reel.src}: в файле нет moov — браузер его не откроет`);
  if (!info.handlers.includes('vide')) problems.push(`${reel.src}: нет видеодорожки`);
  if (!info.width || !info.height) problems.push(`${reel.src}: нулевой размер кадра`);
  if (info.moovAt >= 0 && info.mdatAt >= 0 && info.moovAt > info.mdatAt) {
    problems.push(`${reel.src}: moov в конце файла — автозапуск в ленте начнётся только после полной загрузки (faststart)`);
  }

  const hasAudio = info.handlers.includes('soun');
  if (hasAudio && !reel.sound) {
    problems.push(`${reel.src}: в файле есть звуковая дорожка, а sound: true в данных нет — кнопки звука на карточке не будет`);
  }
  if (!hasAudio && reel.sound) {
    problems.push(`${reel.src}: sound: true, но звуковой дорожки в файле нет — кнопка есть, нажатие ничего не даёт`);
  }

  if (info.duration > MAX_SECONDS) warnings.push(`${reel.src}: ${info.duration.toFixed(1)} с (потолок ${MAX_SECONDS})`);
  if (info.height > MAX_HEIGHT || info.width > MAX_WIDTH) {
    warnings.push(`${reel.src}: ${info.width}×${info.height} (потолок ${MAX_WIDTH}×${MAX_HEIGHT})`);
  }
  if (info.size > MAX_BYTES) {
    warnings.push(`${reel.src}: ${(info.size / 1048576).toFixed(2)} МБ (потолок ${(MAX_BYTES / 1048576).toFixed(0)} МБ) — пережать по VIDEO.md`);
  }
}

console.log(`роликов в данных: ${rows.length}`);

if (warnings.length) {
  console.log(`\nне по потолкам VIDEO.md (${warnings.length}):`);
  for (const w of warnings) console.log('  ·', w);
}

if (problems.length) {
  console.log(`\nполомки (${problems.length}):`);
  for (const p of problems) console.log('  ×', p);
  process.exit(1);
}

console.log('\nвсе ролики на месте: файл, постер, видеодорожка, faststart, флаг звука — сходятся');
