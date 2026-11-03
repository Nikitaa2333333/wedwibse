/// <reference path="../pb_data/types.d.ts" />
// ============================================================
// ЗАЯВКИ ПАР С САЙТА — маршрут POST /api/wed/lead (02.11.2026).
//
// Форма на карточке до 02.11 была заглушкой и ничего не отправляла.
// Запись в leads напрямую закрыта (stage2), заявку пишет маршрут
// из pb_hooks. Здесь — потолок частоты на адрес и чтение заявок
// модераторами (для экрана заявок в админке).
// ============================================================

migrate(
  (app) => {
    const leads = app.findCollectionByNameOrId('leads');
    const mod = '@request.auth.collectionName = "moderators"';
    leads.listRule = `${mod} || (@request.auth.collectionName = "brides" && bride = @request.auth.id)`;
    leads.viewRule = leads.listRule;
    leads.updateRule = mod;
    app.save(leads);

    const s = app.settings();
    if (!s.rateLimits.rules.some((r) => r.label === 'POST /api/wed/lead')) {
      s.rateLimits.rules.push({ label: 'POST /api/wed/lead', maxRequests: 10, duration: 3600, audience: '' });
    }
    app.save(s);
  },
  (app) => {
    const leads = app.findCollectionByNameOrId('leads');
    leads.listRule = '@request.auth.collectionName = "brides" && bride = @request.auth.id';
    leads.viewRule = leads.listRule;
    leads.updateRule = null;
    app.save(leads);
    const s = app.settings();
    s.rateLimits.rules = s.rateLimits.rules.filter((r) => r.label !== 'POST /api/wed/lead');
    app.save(s);
  }
);
