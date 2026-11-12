// Документы сайта → legal_docs базы (12.11.2026). Заливает те документы из
// src/data/legal/docs.json, которые подписывают галочкой (поле kind), если
// такой редакции (kind + date) в базе ещё нет. Текст — тот же HTML, что на
// странице /dokumenty/<slug>/: подпись хранит его хеш.
//   node scripts/legal-seed.mjs            — залить недостающие
//   node scripts/legal-seed.mjs --dry      — только показать
// Нужны PB_URL, PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD (.env), к боевой базе — через scripts/pb-tunnel.sh.
import { readFile } from 'node:fs/promises';
import { loadEnv, pb } from './pb-lib.mjs';

const dry = process.argv.includes('--dry');
const docs = JSON.parse(await readFile('src/data/legal/docs.json', 'utf8')).filter((d) => d.kind);
const api = await pb(await loadEnv());

for (const d of docs) {
  const have = await api.first('legal_docs', `kind = "${d.kind}" && version = "${d.date}"`);
  if (have) { console.log(`= ${d.kind} ${d.date} уже в базе`); continue; }
  const text = await readFile(`src/data/legal/${d.slug}.html`, 'utf8');
  if (dry) { console.log(`+ ${d.kind} ${d.date} «${d.title}» (${text.length} знаков) — не залито, --dry`); continue; }
  await api.create('legal_docs', { kind: d.kind, version: d.date, title: d.title, text, checkbox: d.checkbox });
  console.log(`+ ${d.kind} ${d.date} «${d.title}» залит`);
}
