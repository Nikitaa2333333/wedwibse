// Следующие N ещё не скачанных номеров контактного листа подрядчика — для
// доливки карточки до нормы (40–50 кадров) без повторного отбора глазами:
//   node scripts/yadisk-next.mjs <slug> <N>
// Читает prev/index.tsv (все номера листа) и raw/ (что уже качали),
// печатает первые N свободных номеров по порядку диска — строкой,
// готовой для yadisk-pick. Часть конвейера specialist-page.
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const [slug, n] = process.argv.slice(2);
if (!slug || !n) { console.error('usage: node scripts/yadisk-next.mjs <slug> <N>'); process.exit(1); }

// слаг со слэшем — готовый путь (research/grebnevo/grand-lesnoy), как в prep-photos
const base = slug.includes('/') ? slug : join('research', 'specialists', slug);
const IMG = /\.(jpe?g|png|webp|heic)$/i;
const all = (await readFile(join(base, 'prev', 'index.tsv'), 'utf8'))
  .split('\n')
  .map((l) => l.split('\t'))
  .filter(([num, path]) => num && IMG.test(path ?? ''))
  .map(([num]) => num);

const have = new Set((await readdir(join(base, 'raw'))).map((f) => f.split(/[._ ]/)[0]));
const next = all.filter((num) => !have.has(num)).slice(0, Number(n));

console.log(next.join(' '));
console.error(`${next.length} of ${all.length - have.size} free (${have.size} already in raw/)`);
