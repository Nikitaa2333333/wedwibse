/// <reference path="../pb_data/types.d.ts" />
// ============================================================
// КАБИНЕТ ПОДРЯДЧИКА (второй этап, CABINET.md).
//
// Главный принцип: подрядчик НИКОГДА не пишет в venues / specialists.
// Он пишет только в revisions — свой черновик карточки. Карточку на
// сайте создаёт и меняет одно действие модератора: перевод ревизии
// в approved (хук pb_hooks/cabinet.pb.js). Поэтому опубликовать себя
// в обход модерации нельзя в принципе — правил записи в карточки у
// подрядчика просто нет, а не «есть, но с проверкой».
//
//   vendors         — учётки подрядчиков и площадок, вход по коду на почту
//   revisions       — черновик / правка карточки: ответы шаблона (data),
//                     фото (закрыты до одобрения), статус модерации
//   video_requests  — «добавьте видео»: ссылка на диск, обрабатываем мы
//   venues/specialists + owner, version, contacts (скрытое), form
// ============================================================

migrate(
  (app) => {
    // ---------- учётки ----------
    const vendors = new Collection({
      name: 'vendors',
      type: 'auth',
      // видит и правит только себя; регистрироваться может любой (лимит
      // частоты ниже), удалить учётку — только модератор
      listRule: 'id = @request.auth.id',
      viewRule: 'id = @request.auth.id',
      createRule: '',
      updateRule: 'id = @request.auth.id',
      deleteRule: null,
      // пароля нет вовсе: вход только кодом из письма. Пароль при создании
      // всё равно обязателен (так устроены auth-коллекции) — кабинет
      // присылает случайный и нигде его не хранит.
      passwordAuth: { enabled: false, identityFields: ['email'] },
      otp: {
        enabled: true,
        duration: 600,
        length: 6,
        emailTemplate: {
          subject: 'Код для входа в кабинет — {APP_NAME}',
          body:
            '<p>Здравствуйте!</p>' +
            '<p>Код для входа в кабинет: <strong style="font-size:20px">{OTP}</strong></p>' +
            '<p>Код действует 10 минут. Если вы не запрашивали вход — просто удалите это письмо.</p>' +
            '<p>— {APP_NAME}</p>',
        },
      },
      authToken: { duration: 2592000 }, // 30 дней: кабинет открывают с телефона, вход раз в месяц
      fields: [
        { name: 'name', type: 'text', max: 120 },
        { name: 'phone', type: 'text', max: 40 },
        // кем регистрировался — подсказка шаблону; карточки при этом могут быть любыми
        { name: 'kind', type: 'select', maxSelect: 1, values: ['venue', 'specialist'] },
        // монетизация (этап 4): поля заводим сразу, чтобы не мигрировать живую базу
        { name: 'balance', type: 'number', hidden: true },
        { name: 'trialUntil', type: 'date', hidden: true },
        { name: 'notes', type: 'editor', hidden: true }, // заметки модератора
        { name: 'created', type: 'autodate', onCreate: true },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    });
    app.save(vendors);

    // ---------- карточки: владелец, версия, контакты ----------
    for (const name of ['venues', 'specialists']) {
      const c = app.findCollectionByNameOrId(name);
      c.fields.add(new RelationField({ name: 'owner', collectionId: vendors.id, maxSelect: 1, cascadeDelete: false }));
      // номер одобренной версии: правку, начатую с версии 3, нельзя одобрить
      // поверх версии 4 — иначе модератор затрёт более свежую правку
      c.fields.add(new NumberField({ name: 'version', min: 0, onlyInt: true }));
      // контакты скрыты из публичного API: их отдаёт только кнопка
      // «Показать контакты» (этап 8), иначе платное открытие обходится
      // одним запросом к /api/collections/…/records
      c.fields.add(new JSONField({ name: 'contacts', maxSize: 4000, hidden: true }));
      // ответы шаблона в том виде, в каком их заполнил подрядчик: из них
      // собирается следующая правка (кабинет открывает её заполненной)
      c.fields.add(new JSONField({ name: 'form', maxSize: 200000, hidden: true }));
      c.addIndex(`idx_${name}_owner`, false, 'owner', '');
      app.save(c);
    }

    const venues = app.findCollectionByNameOrId('venues');
    const specialists = app.findCollectionByNameOrId('specialists');

    // ---------- ревизии ----------
    const revisions = new Collection({
      name: 'revisions',
      type: 'base',
      // своё видит только владелец; что можно менять и в каком статусе —
      // решает хук (белый список полей + переходы статусов), правила
      // здесь только про «чьё это»
      listRule: 'owner = @request.auth.id',
      viewRule: 'owner = @request.auth.id',
      createRule: '@request.auth.collectionName = "vendors" && owner = @request.auth.id',
      updateRule: 'owner = @request.auth.id',
      deleteRule: 'owner = @request.auth.id && status = "draft"',
      fields: [
        { name: 'owner', type: 'relation', required: true, collectionId: vendors.id, maxSelect: 1, cascadeDelete: true },
        { name: 'kind', type: 'select', required: true, maxSelect: 1, values: ['venue', 'specialist'] },
        { name: 'categorySlug', type: 'text', max: 60, pattern: '^[a-z0-9-]*$' },
        // адрес страницы закрепляется на черновике: хук не даст занять чужой
        { name: 'slug', type: 'text', max: 80, pattern: '^[a-z0-9-]*$' },
        // карточка, которую правим; пусто — новая, появится при одобрении
        { name: 'venue', type: 'relation', collectionId: venues.id, maxSelect: 1 },
        { name: 'specialist', type: 'relation', collectionId: specialists.id, maxSelect: 1 },
        { name: 'status', type: 'select', required: true, maxSelect: 1, values: ['draft', 'review', 'approved', 'rejected'] },
        { name: 'data', type: 'json', maxSize: 200000 },
        // фото закрыты до одобрения: по прямой ссылке без токена владельца
        // их не открыть, и мусор не живёт на нашем домене даже по ссылке
        {
          name: 'photos', type: 'file', maxSelect: 30, maxSize: 15000000, protected: true,
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp'], thumbs: ['400x0'],
        },
        {
          name: 'avatar', type: 'file', maxSelect: 1, maxSize: 5000000, protected: true,
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp'], thumbs: ['220x220'],
        },
        { name: 'cover', type: 'text', max: 200 }, // имя файла обложки из photos
        { name: 'baseVersion', type: 'number', min: 0, onlyInt: true },
        { name: 'rejectReason', type: 'text', max: 2000 },
        { name: 'submittedAt', type: 'date' },
        { name: 'reviewedAt', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_revisions_owner ON revisions (owner, status)',
        'CREATE INDEX idx_revisions_slug ON revisions (kind, categorySlug, slug)',
        'CREATE INDEX idx_revisions_queue ON revisions (status, submittedAt)',
      ],
    });
    app.save(revisions);

    // ---------- заявки на видео ----------
    const videoRequests = new Collection({
      name: 'video_requests',
      type: 'base',
      listRule: 'owner = @request.auth.id',
      viewRule: 'owner = @request.auth.id',
      createRule: '@request.auth.collectionName = "vendors" && owner = @request.auth.id',
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'owner', type: 'relation', required: true, collectionId: vendors.id, maxSelect: 1, cascadeDelete: true },
        { name: 'venue', type: 'relation', collectionId: venues.id, maxSelect: 1 },
        { name: 'specialist', type: 'relation', collectionId: specialists.id, maxSelect: 1 },
        { name: 'url', type: 'url', required: true },
        { name: 'comment', type: 'text', max: 1000 },
        { name: 'status', type: 'select', required: true, maxSelect: 1, values: ['new', 'in-progress', 'done', 'rejected'] },
        { name: 'reason', type: 'text', max: 1000 }, // почему не смогли обработать — уходит подрядчику
        { name: 'created', type: 'autodate', onCreate: true },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_video_requests_status ON video_requests (status, created)'],
    });
    app.save(videoRequests);

    // ---------- настройки ----------
    const s = app.settings();
    s.meta.appName = 'WED Secrets';
    // Лимиты частоты: бот, засыпающий чужую почту кодами, иначе за час
    // уронит репутацию отправителя — и коды перестанут доходить всем.
    // Лимит считается на IP-адрес, а у мобильных операторов один адрес на
    // тысячи абонентов (CGNAT), поэтому не жмём: 20 кодов за 10 минут.
    // Подбор кода (6 цифр) при 30 попытках за 10 минут бессмыслен.
    s.rateLimits.enabled = true;
    const add = (label, maxRequests, duration, audience = '') => {
      if (!s.rateLimits.rules.some((r) => r.label === label)) s.rateLimits.rules.push({ label, maxRequests, duration, audience });
    };
    add('vendors:requestOTP', 20, 600);
    add('vendors:authWithOTP', 30, 600);
    add('vendors:create', 5, 3600, '@guest');
    add('leads:create', 10, 3600);
    add('/api/wed/', 60, 60);
    // За nginx PocketBase видит все запросы с 127.0.0.1, и лимиты выше
    // заперли бы всех разом. Настоящий адрес берём из X-Real-IP — nginx
    // ставит его сам (proxy_set_header X-Real-IP $remote_addr). Подделать
    // заголовок нельзя, пока база слушает только 127.0.0.1 (pb/README.md).
    s.trustedProxy.headers = ['X-Real-IP'];
    app.save(s);
  },
  (app) => {
    for (const name of ['video_requests', 'revisions']) app.delete(app.findCollectionByNameOrId(name));
    for (const name of ['venues', 'specialists']) {
      const c = app.findCollectionByNameOrId(name);
      c.removeIndex(`idx_${name}_owner`);
      for (const f of ['owner', 'version', 'contacts', 'form']) c.fields.removeByName(f);
      app.save(c);
    }
    app.delete(app.findCollectionByNameOrId('vendors'));
  }
);
