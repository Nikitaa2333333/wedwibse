/// <reference path="../pb_data/types.d.ts" />
// ============================================================
// ЗАЯВКИ ПАР В АДМИНКЕ (07.11.2026, docs/cabinet/LEADS-ADMIN.md).
//
// Срез по заявкам не должен держаться на разборе текста сообщения:
//   source — откуда пришла: card (форма на карточке) / favorites («Написать
//            всем» из избранного);
//   batch  — общий номер одной отправки из избранного: по заявке на каждую
//            карточку, а в админке это одна строка с перечнем карточек;
//   venue / specialist — связь с карточкой по адресу sourceUrl (поля были
//            с самого начала, но не заполнялись).
// Новые заявки размечает хук createLead (pb_hooks/lib/cabinet.js → cardOfUrl).
// Старые — здесь, один раз, по тем же правилам (адрес карточки; «Из избранного»
// в тексте; отправка группой — один телефон с разницей до 5 секунд).
// ============================================================

/** адрес карточки → { col, id }: /moskva/podryadchiki/<кат>/<slug>/, /moskva/ploshchadki/<slug>/ */
function linkOf(app, url) {
  const s = String(url || '');
  let m = s.match(/\/moskva\/podryadchiki\/([a-z0-9-]+)\/([a-z0-9-]+)\/?(?:[?#]|$)/);
  if (m) {
    try {
      return { col: 'specialist', id: app.findFirstRecordByFilter('specialists', 'categorySlug = {:c} && slug = {:s}', { c: m[1], s: m[2] }).id };
    } catch (_) { return null; }
  }
  m = s.match(/\/moskva\/ploshchadki\/([a-z0-9-]+)\/?(?:[?#]|$)/);
  if (m) {
    try {
      return { col: 'venue', id: app.findFirstRecordByFilter('venues', 'slug = {:s}', { s: m[1] }).id };
    } catch (_) { return null; }
  }
  return null;
}

migrate(
  (app) => {
    const leads = app.findCollectionByNameOrId('leads');
    leads.fields.add(new SelectField({ name: 'source', maxSelect: 1, values: ['card', 'favorites'] }));
    leads.fields.add(new TextField({ name: 'batch', max: 40 }));
    leads.addIndex('idx_leads_batch', false, 'batch', '');
    app.save(leads);

    // разметка старых заявок
    const at = (r) => new Date(r.getString('created').replace(' ', 'T')).getTime();
    const all = app.findRecordsByFilter('leads', 'kind = "client"', 'created', 0, 0);
    let prev = null;
    for (const r of all) {
      const fav = r.getString('message').indexOf('Из избранного') !== -1;
      if (!r.getString('source')) r.set('source', fav ? 'favorites' : 'card');
      if (!r.getString('specialist') && !r.getString('venue')) {
        const link = linkOf(app, r.getString('sourceUrl'));
        if (link) r.set(link.col, link.id);
      }
      if (fav && !r.getString('batch')) {
        const same = prev && prev.getString('source') === 'favorites' && prev.getString('phone') === r.getString('phone') && at(r) - at(prev) < 5000;
        r.set('batch', same ? prev.getString('batch') : r.id);
      }
      app.save(r);
      prev = r;
    }
  },
  (app) => {
    const leads = app.findCollectionByNameOrId('leads');
    leads.removeIndex('idx_leads_batch');
    leads.fields.removeByName('source');
    leads.fields.removeByName('batch');
    app.save(leads);
  }
);
