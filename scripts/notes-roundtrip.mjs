// Проверка редактора «Описание» (lib/notes-model.ts) на настоящих текстах:
// story карточки → sections анкеты (как card-to-form) → строки редактора →
// обратно в sections. Сайт после этого должен увидеть ровно то же самое
// (сравниваем разборку parseSection, а не символы: перенос строки внутри
// абзаца и пробел сайт рисует одинаково).
//   node scripts/notes-roundtrip.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { cardToForm } from './card-to-form.mjs';
import { sectionsToBlocks, blocksToSections, storyOf, plainToBlocks } from '../src/lib/notes-model.ts';

const files = [];
const walk = (d) => readdirSync(d).forEach((f) => { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : p.endsWith('.json') && files.push(p); });
walk('src/data/specialists');

let ok = 0, bad = 0;
// что читает человек: заголовок, абзацы, пункты — по порядку. Раздел без
// заголовка визитка рисует продолжением предыдущего (story__sec--cont),
// поэтому два таких раздела подряд и один общий читаются одинаково
const linear = (story) => story.flatMap((s) => [
  ...(s.title ? [`h:${s.title}`] : []), ...(s.text ?? []).map((x) => `p:${x}`),
  ...(s.list ?? []).map((x) => `li:${x}`), ...(s.after ?? []).map((x) => `p:${x}`),
]);
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const same = (a, b) => eq(linear(storyOf(a)), linear(storyOf(b)));
for (const f of files) {
  const card = JSON.parse(readFileSync(f, 'utf8'));
  if (!card.story?.length) continue;
  const before = cardToForm(card).sections;
  const after = blocksToSections(sectionsToBlocks(before));
  const twice = blocksToSections(sectionsToBlocks(after));
  if (same(before, after) && eq(after, twice)) ok++;
  else {
    bad++;
    const a = linear(storyOf(before)), b = linear(storyOf(after));
    const i = a.findIndex((x, k) => x !== b[k]);
    console.log('✗', f, `строка ${i}:`, a[i], '→', b[i], eq(after, twice) ? '' : '(не устойчиво)');
  }
}

// синтетика: порядок «текст → список → текст → список» не сливается
const mixed = [{ t: 'h', text: 'Как я работаю' }, { t: 'p', text: 'Раз' }, { t: 'li', text: 'а' }, { t: 'p', text: 'Два' }, { t: 'li', text: 'б' }];
const ms = blocksToSections(mixed);
const order = eq(sectionsToBlocks(ms), mixed);
console.log(order ? '✓ второй список не сливается с первым' : '✗ порядок списков потерян', JSON.stringify(ms));

// вставка обычного текста
const paste = 'Обо мне\nСнимаю свадьбы с 2015 года.\n\nЧто входит:\n- сборы\n- прогулка\n\nСтоимость\n\nОт 40 000 ₽ за день.';
const pb = plainToBlocks(paste);
console.log(pb.guessed === 2 ? '✓ вставка: 2 заголовка угаданы' : `✗ вставка: угадано ${pb.guessed}`, JSON.stringify(pb.blocks));

console.log(`\n${ok} карточек без потерь, с расхождением ${bad}`);
process.exit(bad || !order || pb.guessed !== 2 ? 1 : 0);
