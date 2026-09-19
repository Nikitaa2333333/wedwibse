// Выгрузка фильтров категорий в JSON — для сборки таблицы-реестра
// (scripts/registry-sheet.py) и любых внешних потребителей.
//   node scripts/filters-dump.mjs [out.json]
// Node 25 читает .ts без сборки (type stripping), поэтому specialist-filters.ts
// импортируется напрямую; specialists.ts сюда не тянем — там import.meta.glob.
import { writeFileSync } from 'node:fs';
import { FILTERS_BY_CATEGORY } from '../src/data/specialist-filters.ts';

const out = process.argv[2] ?? 'research/filters/filters.json';
writeFileSync(out, JSON.stringify(FILTERS_BY_CATEGORY, null, 2));
const groups = Object.values(FILTERS_BY_CATEGORY).reduce((n, g) => n + g.length, 0);
console.log(`${Object.keys(FILTERS_BY_CATEGORY).length} категорий, ${groups} групп → ${out}`);
