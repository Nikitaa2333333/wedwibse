// Наша площадка → анкета кабинета «ведём мы» (решение Никиты 09.11, CABINET §24).
// Страницу из блоков держим мы (JSON в git, в базе — page). Владелец меняет только:
// тип, вместимость, средний чек, значения строк «Характеристик» и «Условий»
// (название строки и место на странице наши), тарифы залов по дням, контакты.
// Анкету кладёт в поле form карточки скрипт pb-cabinet-setup.mjs venue-forms.
// Чистый .mjs без зависимостей: проверка без базы — node scripts/venue-to-form.mjs <slug>.

/** строки страницы, которые владелец правит значением: где лежат (at), группа, подпись, значение */
export function venueRows(page) {
  const rows = [];
  (page.meta ?? []).forEach((r, i) => {
    if (r?.label && r?.value) rows.push({ at: `meta.${i}`, group: 'Характеристики', label: r.label, value: r.value });
  });
  const terms = (groups, base) => (groups ?? []).forEach((g, gi) => (g?.rows ?? []).forEach((r, ri) => {
    if (r?.label && r?.value) rows.push({ at: `${base}.${gi}.rows.${ri}`, group: g.title || 'Условия', label: r.label, value: r.value });
  }));
  if (Array.isArray(page.blocks) && page.blocks.length) {
    page.blocks.forEach((b, bi) => { if (b?.type === 'terms') terms(b.terms, `blocks.${bi}.terms`); });
  } else {
    terms(page.terms, 'terms');
  }
  return rows;
}

/** тарифы залов по дням: зал, день, аренда, заказ от */
export function venueHallTariffs(page) {
  return (page.halls ?? [])
    .filter((h) => h?.id && Array.isArray(h.tariff) && h.tariff.length)
    .map((h) => ({ id: h.id, name: h.name, tariff: h.tariff.map((t) => ({ day: t.day, rent: t.rent, deposit: t.deposit })) }));
}

/** card — запись venues из базы (page, type, checkFrom, capacityBanquet, contacts) */
export function venueToForm(card) {
  const page = card.page ?? {};
  return {
    managed: true,
    name: card.name || page.name || '',
    address: page.contacts?.address || card.address || '',
    type: card.type || '',
    checkFrom: card.checkFrom || null,
    capacityBanquet: card.capacityBanquet || null,
    rows: venueRows(page),
    hallTariffs: venueHallTariffs(page),
    contacts: card.contacts && typeof card.contacts === 'object' ? card.contacts : {},
  };
}

// node scripts/venue-to-form.mjs grebnevo — что попадёт в анкету, по JSON из git (без базы)
if (import.meta.url === `file://${process.argv[1]}`) {
  const { readFile } = await import('node:fs/promises');
  for (const slug of process.argv.slice(2)) {
    const page = JSON.parse(await readFile(`src/data/venues/${slug}.json`, 'utf8'));
    const f = venueToForm({ name: page.name, page });
    console.log(`${slug}: строк ${f.rows.length}, залов с тарифом ${f.hallTariffs.length}`);
    for (const r of f.rows) console.log(`  [${r.group}] ${r.label}: ${r.value}`);
    for (const h of f.hallTariffs) console.log(`  зал ${h.name}: ${h.tariff.map((t) => `${t.day} ${t.rent}/${t.deposit}`).join('; ')}`);
  }
}
