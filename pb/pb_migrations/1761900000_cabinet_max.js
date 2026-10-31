/// <reference path="../pb_data/types.d.ts" />
// ============================================================
// ВХОД ЧЕРЕЗ MAX — рядом с Telegram (CABINET.md §23).
//
// Готового виджета входа у MAX нет, поэтому вход через бота:
//   1. сайт берёт одноразовый код (POST /api/wed/max/start) и открывает
//      max.ru/<бот>?start=<код>;
//   2. человек жмёт «Начать», MAX шлёт вебхук bot_started с этим кодом —
//      хук записывает в max_logins, чей это аккаунт MAX;
//   3. сайт спрашивает POST /api/wed/max { code } — код подтверждён,
//      дальше как у Telegram: учётка есть — вход, нет — условия.
//
//   vendors.maxId — номер пользователя MAX (user_id), как telegramId.
//   max_logins    — коды входа; в базе SHA-256 кода, не сам код. Правил
//                   доступа нет: читают и пишут только хуки.
// ============================================================

migrate(
  (app) => {
    const vendors = app.findCollectionByNameOrId('vendors');
    vendors.fields.add(new TextField({ name: 'maxId', max: 20, pattern: '^[0-9]*$' }));
    vendors.addIndex('idx_vendors_max', true, 'maxId', 'maxId != ""');
    vendors.authRule = 'verified = true || telegramId != "" || maxId != ""';
    app.save(vendors);

    const logins = new Collection({
      name: 'max_logins',
      type: 'base',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'codeHash', type: 'text', required: true, max: 64 },
        { name: 'maxId', type: 'text', max: 20, pattern: '^[0-9]*$' },
        { name: 'name', type: 'text', max: 120 },
        { name: 'expiresAt', type: 'date', required: true },
        { name: 'created', type: 'autodate', onCreate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_max_logins_code ON max_logins (codeHash)'],
    });
    app.save(logins);

    // коды выдаются без входа — потолок на адрес, чтобы базу не забили
    const s = app.settings();
    if (!s.rateLimits.rules.some((r) => r.label === 'POST /api/wed/max/start')) {
      s.rateLimits.rules.push({ label: 'POST /api/wed/max/start', maxRequests: 10, duration: 60, audience: '' });
    }
    app.save(s);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('max_logins'));
    const vendors = app.findCollectionByNameOrId('vendors');
    vendors.authRule = 'verified = true || telegramId != ""';
    vendors.removeIndex('idx_vendors_max');
    vendors.fields.removeByName('maxId');
    app.save(vendors);
  }
);
