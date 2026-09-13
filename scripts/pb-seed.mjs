// Заливает площадки в PocketBase (upsert по citySlug+slug):
//   node scripts/pb-seed.mjs [slug ...] [--legacy] [--publish]
// Источники: src/data/venues/<slug>.json (конвейер venue-page) и, с --legacy,
// четыре площадки, записанные объектами в src/data/venues.ts. Фото —
// файлы из src/assets/venues/<slug>/, на которые ссылается объект;
// заливаются один раз (по имени файла), повторный запуск докидывает новые.
// Плоские колонки под фильтры считаются из объекта (вместимость, чек,
// тип по kicker) — грубо, но честно; править их точно — в админке.
// Статус новой записи draft; --publish ставит published.
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { loadEnv, pb } from './pb-lib.mjs';

const argv = process.argv.slice(2);
const legacy = argv.includes('--legacy');
const publish = argv.includes('--publish');
const only = argv.filter((a) => !a.startsWith('--'));

const api = await pb(await loadEnv());

// ---------- источники ----------
const venues = [];
for (const f of await readdir('src/data/venues').catch(() => [])) {
  if (f.endsWith('.json')) venues.push(JSON.parse(await readFile(join('src/data/venues', f), 'utf8')));
}
if (legacy) {
  // venues.ts — чистый TS без зависимостей, кроме import.meta.glob (Vite):
  // вырезаем его и исполняем Node со снятием типов.
  const src = (await readFile('src/data/venues.ts', 'utf8')).replace(/import\.meta\.glob<Venue>\([\s\S]*?\{ eager: true, import: 'default' \}\s*\)/, '{}');
  const tmp = join('research', '_venues-legacy.ts');
  await (await import('node:fs/promises')).writeFile(tmp, src);
  const mod = await import(`file://${process.cwd()}/${tmp}`.replace(/\\/g, '/'));
  for (const v of mod.VENUES) if (!v.blocks) venues.push(v);
}
const todo = only.length ? venues.filter((v) => only.includes(v.slug)) : venues;
console.log(`площадок к заливке: ${todo.length}`);

// ---------- плоские поля из объекта ----------
const num = (s) => { const m = String(s ?? '').replace(/[\s ]/g, '').match(/\d{2,7}/); return m ? Number(m[0]) : null; };
const TYPE_BY_WORD = [['оранжере', 'oranzhereya'], ['лофт', 'loft'], ['ресторан', 'restoran'], ['банкет', 'banketnyj-zal'], ['шат', 'shater'], ['веранд', 'veranda'], ['усадь', 'usadba'], ['клуб', 'zagorodnyj-klub'], ['яхт', 'yaht-klub'], ['зал', 'banketnyj-zal']];
function flat(v) {
  const meta = Object.fromEntries((v.meta ?? []).map((r) => [r.label.toLowerCase(), r.value]));
  const cap = meta['вместимость'] ?? '';
  const banquet = num(cap.split('·')[0]) ?? num(v.stats?.find((s) => /банкет/i.test(s.label))?.value);
  const buffet = num(cap.split('·')[1]);
  const k = `${v.kicker ?? ''} ${v.name ?? ''} ${v.title ?? ''}`.toLowerCase();
  const type = TYPE_BY_WORD.find(([w]) => k.includes(w))?.[1] ?? 'drugoe';
  const allRows = [...(v.terms ?? []).flatMap((t) => t.rows), ...(v.scenes ?? []).flatMap((s) => s.facts ?? [])];
  const menu = allRows.find((r) => /^меню/i.test(r.label) && /₽/.test(r.value));
  const rent = allRows.find((r) => /аренда/i.test(r.label) && /₽/.test(r.value));
  const km = num(v.contacts?.routes?.find((r) => /мкад/i.test(r.label))?.value);
  const text = JSON.stringify(v).toLowerCase();
  const features = [];
  if (/пробкового сбора нет|свой алкоголь|алкоголь.*с собой/.test(text)) features.push('svoj-alkogol');
  if (/выездн(ая|ой) (регистраци|церемони)/.test(text)) features.push('vyezdnaya-registraciya');
  if (km && km > 0) features.push('za-gorodom');
  if (/под закрытие/.test(text)) features.push('pod-zakrytie');
  if (/прожива|гостиниц|отел/.test(text)) features.push('prozhivanie');
  if (/собственн(ая|ый) (кухн|кейтеринг|служб)|своя кухня|кухня ресторана/.test(text)) features.push('svoya-kuhnya');
  if (/парковк/.test(text)) features.push('parkovka');
  if (/веранд|террас/.test(text)) features.push('terrasa');
  if (/озер|пруд|водоём|реки|берег|у воды|слияни/.test(text)) features.push('u-vody');
  return {
    slug: v.slug, name: v.name, kicker: v.kicker, citySlug: v.citySlug, city: v.city, type,
    capacityBanquet: banquet, capacityBuffet: buffet,
    checkFrom: menu ? num(menu.value) : null, rentFrom: rent ? num(rent.value) : null, kmFromMkad: km,
    districts: ['podmoskovie'], purposes: ['svadba', 'korporativ', 'den-rozhdeniya'], features,
    geo: v.contacts?.geo ?? null, address: v.contacts?.address ?? '', phone: v.contacts?.phone ?? '',
    email: v.contacts?.email || null, site: v.contacts?.links?.find((l) => /сайт/i.test(l.label))?.href ?? null,
    page: v,
  };
}

// ---------- upsert ----------
for (const v of todo) {
  const existing = await api.first('venues', `citySlug = "${v.citySlug}" && slug = "${v.slug}"`);
  const data = flat(v);
  if (!existing) data.status = publish ? 'published' : 'draft';
  else if (publish) data.status = 'published';
  const rec = existing ? await api.update('venues', existing.id, data) : await api.create('venues', data);

  // фото: всё, на что ссылается объект, из src/assets/venues/<slug>/.
  // PB переименовывает файлы, поэтому соответствие «имя в PB → исходный
  // путь» держим в photoIndex; уже залитое — не повторяем.
  const refs = [...new Set(JSON.stringify(v).match(new RegExp(`/venues/${v.slug}/[\\w./-]+\\.(webp|jpg)`, 'g')) ?? [])];
  const index = { ...(rec.photoIndex ?? {}) };
  for (const k of Object.keys(index)) if (!(rec.photos ?? []).includes(k)) delete index[k]; // файл удалили в админке
  const have = new Set(Object.values(index));
  const form = new FormData();
  const queued = [];
  for (const ref of refs) {
    if (have.has(ref)) continue;
    const file = ref.slice(`/venues/${v.slug}/`.length);
    try {
      const buf = await readFile(join('src/assets/venues', v.slug, file));
      form.append('photos+', new Blob([buf], { type: file.endsWith('.jpg') ? 'image/jpeg' : 'image/webp' }), file.replace(/\//g, '_'));
      queued.push(ref);
    } catch { console.error(`  нет файла ${file}`); }
  }
  if (queued.length) {
    const before = rec.photos ?? [];
    const after = await api.update('venues', rec.id, form);
    // PB дописывает новые файлы в конец в порядке загрузки
    const fresh = after.photos.filter((n) => !before.includes(n));
    if (fresh.length !== queued.length) console.error(`  ${v.slug}: залито ${fresh.length}, ожидалось ${queued.length} — индекс может разойтись`);
    fresh.forEach((n, i) => { if (queued[i]) index[n] = queued[i]; });
    await api.update('venues', rec.id, { photoIndex: index });
  }
  console.log(`${existing ? '↻' : '+'} ${v.slug}: ${data.type}, банкет ${data.capacityBanquet ?? '—'}, чек ${data.checkFrom ?? '—'}, фото +${queued.length} (всего ${have.size + queued.length})`);
}
