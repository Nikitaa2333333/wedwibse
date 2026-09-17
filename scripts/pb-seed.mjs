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
  // Комплекс из залов (venue.halls, Гребнево): в фильтрах карточка живёт
  // по самому большому залу и самой низкой аренде — у «от 30 до 350»
  // регулярка иначе берёт первое число, и усадьба на 350 гостей уходит
  // в «до 50». Одиночная площадка — как раньше, из meta.
  const halls = v.halls ?? [];
  const banquet = halls.length
    ? Math.max(...halls.map((h) => h.banquet))
    : num(cap.split('·')[0]) ?? num(v.stats?.find((s) => /банкет/i.test(s.label))?.value);
  const buffet = halls.length ? Math.max(...halls.map((h) => h.buffet)) : num(cap.split('·')[1]);
  const hallRent = halls.length ? Math.min(...halls.flatMap((h) => h.tariff.map((t) => num(t.rent)).filter(Boolean))) : null;
  const k = `${v.kicker ?? ''} ${v.name ?? ''} ${v.title ?? ''}`.toLowerCase();
  const type = TYPE_BY_WORD.find(([w]) => k.includes(w))?.[1] ?? 'drugoe';
  // Цены: у legacy-площадок terms/scenes лежат сверху, у JSON конвейера —
  // блоками в blocks. Ряд «аренда» узнаём и по заголовку группы (в блоках
  // строки называются днями недели, а «Аренда оранжереи» — это title группы).
  const blocks = v.blocks ?? [];
  const termGroups = [...(v.terms ?? []), ...blocks.filter((b) => b.type === 'terms').flatMap((b) => b.terms ?? [])];
  const sceneFacts = [...(v.scenes ?? []), ...blocks.filter((b) => b.type === 'scenes').flatMap((b) => b.scenes ?? [])].flatMap((s) => s.facts ?? []);
  const allRows = [
    ...termGroups.flatMap((t) => (t.rows ?? []).map((r) => ({ ...r, group: t.title ?? '' }))),
    ...sceneFacts.map((r) => ({ ...r, group: '' })),
  ].filter((r) => /₽/.test(r.value ?? ''));
  const minOf = (rows) => rows.length ? rows.reduce((m, r) => Math.min(m, num(r.value) ?? m), Infinity) : null;
  const rentRows = allRows.filter((r) => /аренда/i.test(`${r.label} ${r.group}`));
  // строка с «аренда» в подписи — аренда, даже если группа называется «Депозит и сервис»
  const menuRows = allRows.filter((r) => !/аренда/i.test(r.label) && /^меню|чек|на гостя|с человека|депозит|минимальн/i.test(`${r.label} ${r.group}`));
  const menu = menuRows.length ? { value: String(minOf(menuRows)) } : null;
  const rent = hallRent ? { value: String(hallRent) } : rentRows.length ? { value: String(minOf(rentRows)) } : null;
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

// ролики площадки — из data/reels.ts без сборки (чистый TS, читаем регуляркой)
const reelsSrc = await readFile('src/data/reels.ts', 'utf8').catch(() => '');
function reelsOf(slug) {
  const out = [];
  for (const m of reelsSrc.matchAll(/src:\s*'([^']+)'[^}]*venue:\s*'([^']*)'/g)) if (m[2] === slug) out.push(m[1]);
  return out;
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
  const present = new Set([...(rec.photos ?? []), ...(rec.reels ?? [])]);
  for (const k of Object.keys(index)) if (!present.has(k)) delete index[k]; // файл удалили в админке
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
  // ролики (public/venues/<slug>/reel-NN.mp4) — в поле reels, индекс общий с фото
  const queuedReels = [];
  for (const ref of reelsOf(v.slug)) {
    if (have.has(ref)) continue;
    try {
      const buf = await readFile(join('public', ref));
      form.append('reels+', new Blob([buf], { type: 'video/mp4' }), ref.split('/').pop());
      queuedReels.push(ref);
    } catch { console.error(`  нет ролика public${ref}`); }
  }
  if (queued.length || queuedReels.length) {
    const before = { photos: rec.photos ?? [], reels: rec.reels ?? [] };
    const after = await api.update('venues', rec.id, form);
    // PB дописывает новые файлы в конец в порядке загрузки
    const fresh = after.photos.filter((n) => !before.photos.includes(n));
    const freshReels = (after.reels ?? []).filter((n) => !before.reels.includes(n));
    if (fresh.length !== queued.length || freshReels.length !== queuedReels.length) console.error(`  ${v.slug}: залито ${fresh.length}+${freshReels.length}, ожидалось ${queued.length}+${queuedReels.length} — индекс может разойтись`);
    fresh.forEach((n, i) => { if (queued[i]) index[n] = queued[i]; });
    freshReels.forEach((n, i) => { if (queuedReels[i]) index[n] = queuedReels[i]; });
    await api.update('venues', rec.id, { photoIndex: index });
  }
  console.log(`${existing ? '↻' : '+'} ${v.slug}: ${data.type}, банкет ${data.capacityBanquet ?? '—'}, чек ${data.checkFrom ?? '—'}, аренда ${data.rentFrom ?? '—'}, фото +${queued.length}, ролики +${queuedReels.length} (в индексе ${Object.keys(index).length})`);
}
