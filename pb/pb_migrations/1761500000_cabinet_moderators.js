/// <reference path="../pb_data/types.d.ts" />
// ============================================================
// МОДЕРАТОРЫ — сквозной путь «подрядчик → модерация → публикация»
// (STAGE2.md, «Сквозная проверка»).
//
//   moderators — учётки модераторов, вход почтой и паролем. Заводит их
//                суперпользователь (createRule закрыт): регистрации нет.
//
// Модератор видит все ревизии и учётки подрядчиков и меняет статус
// ревизии (review → approved | rejected). Что именно ему можно менять,
// решает хук (lib/cabinet.js, moderateRevision) — правило здесь только
// про «кому вообще можно в эту коллекцию». Суперпользователь для
// модерации больше не нужен: его токен в браузере открывал бы всю базу.
// ============================================================

const MOD = '@request.auth.collectionName = "moderators"';

migrate(
  (app) => {
    const moderators = new Collection({
      name: 'moderators',
      type: 'auth',
      listRule: 'id = @request.auth.id',
      viewRule: 'id = @request.auth.id',
      createRule: null,
      updateRule: 'id = @request.auth.id',
      deleteRule: null,
      passwordAuth: { enabled: true, identityFields: ['email'] },
      authToken: { duration: 1209600 }, // 14 дней
      fields: [
        { name: 'name', type: 'text', max: 120 },
        { name: 'created', type: 'autodate', onCreate: true },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    });
    app.save(moderators);

    const revisions = app.findCollectionByNameOrId('revisions');
    revisions.listRule = `owner = @request.auth.id || ${MOD}`;
    revisions.viewRule = `owner = @request.auth.id || ${MOD}`;
    revisions.updateRule = `owner = @request.auth.id || ${MOD}`;
    app.save(revisions);

    const vendors = app.findCollectionByNameOrId('vendors');
    vendors.listRule = `id = @request.auth.id || ${MOD}`;
    vendors.viewRule = `id = @request.auth.id || ${MOD}`;
    app.save(vendors);

    // модератору — черновики карточек тоже: «было» на экране разбора
    for (const name of ['venues', 'specialists']) {
      const c = app.findCollectionByNameOrId(name);
      c.listRule = `status = "published" || ${MOD}`;
      c.viewRule = `status = "published" || ${MOD}`;
      app.save(c);
    }

    const s = app.settings();
    if (!s.rateLimits.rules.some((r) => r.label === 'moderators:authWithPassword')) {
      s.rateLimits.rules.push({ label: 'moderators:authWithPassword', maxRequests: 20, duration: 600, audience: '' });
    }
    app.save(s);
  },
  (app) => {
    for (const name of ['venues', 'specialists']) {
      const c = app.findCollectionByNameOrId(name);
      c.listRule = 'status = "published"';
      c.viewRule = 'status = "published"';
      app.save(c);
    }
    const vendors = app.findCollectionByNameOrId('vendors');
    vendors.listRule = 'id = @request.auth.id';
    vendors.viewRule = 'id = @request.auth.id';
    app.save(vendors);
    const revisions = app.findCollectionByNameOrId('revisions');
    revisions.listRule = 'owner = @request.auth.id';
    revisions.viewRule = 'owner = @request.auth.id';
    revisions.updateRule = 'owner = @request.auth.id';
    app.save(revisions);
    app.delete(app.findCollectionByNameOrId('moderators'));
  }
);
