// Вставляет текст карточки структурой исходника (поле story, CHARACTER.md):
//   node scripts/story-put.mjs <категория>/<slug> <story.json>
// story.json — массив StorySection. Скрипт расставляет неразрывные пробелы
// (после слов в 1–2 буквы, перед тире, в числах и перед ₽), проверяет, что
// каждая фраза маркера (mark) реально есть в тексте раздела, и кладёт story
// в JSON карточки после aboutTitle — остальные поля и их порядок не трогает.
import { readFileSync, writeFileSync } from 'node:fs';

const [card, storyFile] = process.argv.slice(2);
if (!card || !storyFile) throw new Error('usage: story-put.mjs <категория>/<slug> <story.json>');

const NB = ' ';
const short = /(^|[\s(«“"])([А-Яа-яЁёA-Za-z]{1,2})\s/g;
const ty = (s) =>
  s
    .replace(short, (_, a, w) => a + w + NB)
    .replace(short, (_, a, w) => a + w + NB) // второй проход: «и в доме»
    .replace(/ —/g, NB + '—')
    .replace(/(\d) (\d{3})/g, `$1${NB}$2`)
    .replace(/(\d) ₽/g, `$1${NB}₽`);
const walk = (v) =>
  typeof v === 'string' ? ty(v)
    : Array.isArray(v) ? v.map(walk)
      : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)])) : v;

const story = walk(JSON.parse(readFileSync(storyFile, 'utf8')));

// маркер, которого нет в тексте раздела, молча не подсветится — ловим сразу
for (const [i, sec] of story.entries()) {
  const text = JSON.stringify({ ...sec, mark: undefined });
  for (const m of sec.mark ?? []) if (!text.includes(JSON.stringify(m).slice(1, -1))) throw new Error(`раздел ${i}: фразы маркера нет в тексте — «${m}»`);
}

const path = `src/data/specialists/${card}.json`;
const raw = readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const j = JSON.parse(raw);
const out = {};
for (const [k, v] of Object.entries(j)) {
  if (k === 'story') continue;
  out[k] = v;
  if (k === 'aboutTitle') out.story = story;
}
if (!out.story) out.story = story;

// старые массивы в файлах записаны в строку — сохраняем стиль, чтобы diff был только про story
const body = JSON.stringify(out, null, 2).replace(/\[\n\s+("[^"\n]*"(?:,\n\s+"[^"\n]*")*)\n\s+\]/g, (m, inner) =>
  m.length < 200 && !inner.includes('/') ? `[${inner.replace(/,\n\s+/g, ', ')}]` : m);
writeFileSync(path, body + '\n');
console.log(`${card}: story — ${story.length} разделов`);
