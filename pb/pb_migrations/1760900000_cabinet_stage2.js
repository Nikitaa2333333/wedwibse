/// <reference path="../pb_data/types.d.ts" />
// ============================================================
// КАБИНЕТ — решения 16.10 и 20.10 (CABINET.md, разделы 21–22; STAGE2.md §7.2).
//
//   vendors      — вход паролем включён (почта подтверждается кодом из
//                  письма, сброс — ссылкой из письма), вход через Telegram
//                  (поле telegramId, подпись виджета проверяет хук).
//                  Регистрация — только маршрутом /api/wed/telegram: без
//                  принятых условий учётку не создаём (createRule закрыт).
//   legal_docs   — редакции оферты и согласий; только добавление
//   signatures   — кто, что и когда подписал; пишет только хук
//   invites      — личные одноразовые ссылки пилота: карточка → владелец
//   brides       — учётки невест, вход кодом на почту
//   favorites    — избранное невесты на всех устройствах
//   leads        — + bride; создаются маршрутом /api/wed/lead
//   revisions    — фото до 50 на карточку считает хук (потолок поля выше:
//                  у пилотных площадок уже больше 50 кадров, правка их не режет)
// ============================================================

migrate(
  (app) => {
    // ---------- подрядчики: пароль + Telegram ----------
    const vendors = app.findCollectionByNameOrId('vendors');
    vendors.passwordAuth = { enabled: true, identityFields: ['email'] };
    // войти можно с подтверждённой почтой или через Telegram. Код из письма
    // подтверждает почту сам: учётка, вошедшая кодом, становится verified
    vendors.authRule = 'verified = true || telegramId != ""';
    // регистрация — маршрутом /api/wed/telegram, вместе с подписью условий
    vendors.createRule = null;
    // учётке из Telegram почта не нужна: её можно добавить позже
    vendors.fields.getByName('email').required = false;
    vendors.fields.add(new TextField({ name: 'telegramId', max: 20, pattern: '^[0-9]*$' }));
    vendors.addIndex('idx_vendors_telegram', true, 'telegramId', 'telegramId != ""');
    vendors.resetPasswordTemplate = {
      subject: 'Новый пароль для кабинета — {APP_NAME}',
      body:
        '<p>Здравствуйте!</p>' +
        '<p>Чтобы задать новый пароль, откройте ссылку: ' +
        '<a href="https://profi.wed-secrets.ru/vhod/parol/?token={TOKEN}">задать пароль</a>.</p>' +
        '<p>Если вы не просили сменить пароль — просто удалите это письмо, старый продолжит работать.</p>' +
        '<p>— {APP_NAME}</p>',
    };
    app.save(vendors);

    // ---------- документы и подписи ----------
    const legalDocs = new Collection({
      name: 'legal_docs',
      type: 'base',
      // тексты открыты: их показывают на экране регистрации до входа
      listRule: '',
      viewRule: '',
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        // действует последняя редакция каждого вида
        { name: 'kind', type: 'select', required: true, maxSelect: 1, values: ['vendor-offer', 'vendor-pdn', 'bride-pdn'] },
        { name: 'version', type: 'text', required: true, max: 40 }, // «2026-11-01»
        { name: 'title', type: 'text', required: true, max: 200 },
        { name: 'text', type: 'editor', required: true },
        // дословный текст галочки — он же уходит в подпись
        { name: 'checkbox', type: 'text', required: true, max: 500 },
        { name: 'hash', type: 'text', max: 64 }, // SHA-256 текста, ставит хук
        { name: 'created', type: 'autodate', onCreate: true },
      ],
      indexes: ['CREATE INDEX idx_legal_docs_kind ON legal_docs (kind, created)'],
    });
    app.save(legalDocs);

    const brides = new Collection({
      name: 'brides',
      type: 'auth',
      listRule: 'id = @request.auth.id',
      viewRule: 'id = @request.auth.id',
      // учётка появляется сама при первой заявке (/api/wed/lead)
      createRule: null,
      updateRule: 'id = @request.auth.id',
      deleteRule: null,
      // пароль — по желанию; без него вход кодом на почту
      passwordAuth: { enabled: true, identityFields: ['email'] },
      otp: {
        enabled: true,
        duration: 600,
        length: 6,
        emailTemplate: {
          subject: 'Код для входа — {APP_NAME}',
          body:
            '<p>Здравствуйте!</p>' +
            '<p>Код для входа в ваш кабинет: <strong style="font-size:20px">{OTP}</strong></p>' +
            '<p>Код действует 10 минут. Если вы не запрашивали вход — просто удалите это письмо.</p>' +
            '<p>— {APP_NAME}</p>',
        },
      },
      authToken: { duration: 7776000 }, // 90 дней: «это устройство уже вошло»
      fields: [
        { name: 'name', type: 'text', max: 120 },
        { name: 'phone', type: 'text', max: 40 },
        // только цифры телефона: по ним «один телефон — одна учётка»
        { name: 'phoneDigits', type: 'text', max: 20, hidden: true },
        { name: 'weddingDate', type: 'date' },
        { name: 'guests', type: 'number', min: 0, onlyInt: true },
        { name: 'notes', type: 'editor', hidden: true }, // заметки модератора
        { name: 'created', type: 'autodate', onCreate: true },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_brides_phone ON brides (phoneDigits) WHERE phoneDigits != ""'],
    });
    app.save(brides);

    const signatures = new Collection({
      name: 'signatures',
      type: 'base',
      // пишет только хук; править и удалять не может никто, кроме суперадмина
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'vendor', type: 'relation', collectionId: vendors.id, maxSelect: 1 },
        { name: 'bride', type: 'relation', collectionId: brides.id, maxSelect: 1 },
        { name: 'doc', type: 'relation', required: true, collectionId: legalDocs.id, maxSelect: 1 },
        { name: 'kind', type: 'text', max: 40 },
        { name: 'docVersion', type: 'text', max: 40 },
        { name: 'docHash', type: 'text', max: 64 },
        { name: 'checkbox', type: 'text', max: 500 },
        // как вошёл в момент подписи: password / otp / telegram / invite / lead
        { name: 'method', type: 'text', max: 20 },
        { name: 'ip', type: 'text', max: 64 },
        { name: 'userAgent', type: 'text', max: 500 },
        { name: 'created', type: 'autodate', onCreate: true },
      ],
      indexes: [
        'CREATE INDEX idx_signatures_vendor ON signatures (vendor, kind)',
        'CREATE INDEX idx_signatures_bride ON signatures (bride, kind)',
      ],
    });
    app.save(signatures);

    // ---------- приглашения пилота ----------
    const venues = app.findCollectionByNameOrId('venues');
    const specialists = app.findCollectionByNameOrId('specialists');
    const invites = new Collection({
      name: 'invites',
      type: 'base',
      // только суперпользователь и хук; в ссылке — сам ключ, в базе — его хэш
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'tokenHash', type: 'text', required: true, max: 64 },
        { name: 'venue', type: 'relation', collectionId: venues.id, maxSelect: 1, cascadeDelete: true },
        { name: 'specialist', type: 'relation', collectionId: specialists.id, maxSelect: 1, cascadeDelete: true },
        { name: 'expiresAt', type: 'date', required: true },
        { name: 'usedAt', type: 'date' },
        { name: 'usedBy', type: 'relation', collectionId: vendors.id, maxSelect: 1 },
        { name: 'note', type: 'text', max: 500 }, // кому отправили
        { name: 'created', type: 'autodate', onCreate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_invites_token ON invites (tokenHash)'],
    });
    app.save(invites);

    // ---------- избранное невесты ----------
    const favorites = new Collection({
      name: 'favorites',
      type: 'base',
      listRule: 'bride = @request.auth.id',
      viewRule: 'bride = @request.auth.id',
      createRule: '@request.auth.collectionName = "brides" && bride = @request.auth.id',
      updateRule: 'bride = @request.auth.id && @request.body.bride:isset = false && @request.body.itemId:isset = false',
      deleteRule: 'bride = @request.auth.id',
      fields: [
        { name: 'bride', type: 'relation', required: true, collectionId: brides.id, maxSelect: 1, cascadeDelete: true },
        // тот же ключ, что в localStorage сайта (lib/favorites.ts): `${cat}:${slug}`
        { name: 'itemId', type: 'text', required: true, max: 200 },
        // снимок карточки для списка — как в localStorage, без запроса каталога
        { name: 'item', type: 'json', maxSize: 4000 },
        // статус и заметка по подрядчику — «Мои подрядчики» в кабинете невесты
        { name: 'status', type: 'select', maxSelect: 1, values: ['thinking', 'chosen', 'declined'] },
        { name: 'note', type: 'text', max: 2000 },
        { name: 'created', type: 'autodate', onCreate: true },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_favorites_item ON favorites (bride, itemId)'],
    });
    app.save(favorites);

    // ---------- заявки: связь с невестой ----------
    const leads = app.findCollectionByNameOrId('leads');
    leads.fields.add(new RelationField({ name: 'bride', collectionId: brides.id, maxSelect: 1, cascadeDelete: false }));
    leads.addIndex('idx_leads_bride', false, 'bride', '');
    // невеста видит свои заявки; создаёт их только маршрут /api/wed/lead —
    // он же заводит учётку и пишет согласие на ПДн
    leads.listRule = '@request.auth.collectionName = "brides" && bride = @request.auth.id';
    leads.viewRule = '@request.auth.collectionName = "brides" && bride = @request.auth.id';
    leads.createRule = null;
    app.save(leads);

    // ---------- ревизии: потолок фото ----------
    // 50 на карточку считает хук; у поля потолок как у карточки площадки,
    // иначе правка Гребнево (102 кадра) не открылась бы
    const revisions = app.findCollectionByNameOrId('revisions');
    revisions.fields.getByName('photos').maxSelect = 300;
    app.save(revisions);

    // ---------- лимиты частоты ----------
    const s = app.settings();
    const add = (label, maxRequests, duration, audience = '') => {
      if (!s.rateLimits.rules.some((r) => r.label === label)) s.rateLimits.rules.push({ label, maxRequests, duration, audience });
    };
    add('vendors:authWithPassword', 30, 600);
    add('vendors:requestPasswordReset', 10, 3600);
    add('brides:requestOTP', 20, 600);
    add('brides:authWithOTP', 30, 600);
    add('brides:authWithPassword', 30, 600);
    add('brides:requestPasswordReset', 10, 3600);
    add('/api/wed/telegram', 30, 600);
    add('/api/wed/invite', 10, 600);
    add('/api/wed/lead', 10, 3600);
    app.save(s);
  },
  (app) => {
    const leads = app.findCollectionByNameOrId('leads');
    leads.removeIndex('idx_leads_bride');
    leads.fields.removeByName('bride');
    leads.listRule = null;
    leads.viewRule = null;
    leads.createRule = '';
    app.save(leads);
    for (const name of ['favorites', 'invites', 'signatures', 'brides', 'legal_docs']) app.delete(app.findCollectionByNameOrId(name));
    const revisions = app.findCollectionByNameOrId('revisions');
    revisions.fields.getByName('photos').maxSelect = 30;
    app.save(revisions);
    const vendors = app.findCollectionByNameOrId('vendors');
    vendors.removeIndex('idx_vendors_telegram');
    vendors.fields.removeByName('telegramId');
    vendors.fields.getByName('email').required = true;
    vendors.passwordAuth = { enabled: false, identityFields: ['email'] };
    vendors.authRule = '';
    vendors.createRule = '';
    app.save(vendors);
  }
);
