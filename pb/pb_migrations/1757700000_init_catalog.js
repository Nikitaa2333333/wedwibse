/// <reference path="../pb_data/types.d.ts" />
// ============================================================
// СХЕМА КАТАЛОГА WED SECRETS — PocketBase 0.40.
// Источник правды по структуре базы — этот файл, а не админка:
// миграция версионируется в git и накатывается автоматически при старте
// (pocketbase serve --automigrate, по умолчанию включено). Изменение
// схемы — новая миграция рядом, не правка этой.
//
// Принцип: запись площадки = то же, что src/data/venues/<slug>.json
// (тип Venue, тело страницы блоками в page.blocks), плюс ПЛОСКИЕ колонки
// под фильтры каталога и посадочные (тип, вместимость, чек, округ,
// особенности) — по ним индексы и запросы, по JSON никто не фильтрует.
// Фото — файловое поле записи: PocketBase хранит оригиналы (2400–3000 px,
// см. CLAUDE.md) и отдаёт тумбнейлы сам (?thumb=WxH); при сборке сайта
// scripts/pb-pull.mjs забирает записи и оригиналы в src/, дальше их
// пережимает astro:assets как и сейчас.
// ============================================================

migrate(
  (app) => {
    // ---------- площадки ----------
    const venues = new Collection({
      name: 'venues',
      type: 'base',
      // читать может кто угодно, но только опубликованные; писать — только суперпользователь
      listRule: 'status = "published"',
      viewRule: 'status = "published"',
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'slug', type: 'text', required: true, min: 2, max: 80, pattern: '^[a-z0-9-]+$' },
        { name: 'status', type: 'select', required: true, maxSelect: 1, values: ['draft', 'review', 'published', 'archived'] },
        { name: 'name', type: 'text', required: true, max: 120 },
        { name: 'kicker', type: 'text', max: 40 },
        { name: 'citySlug', type: 'text', required: true, max: 40 },
        { name: 'city', type: 'text', max: 80 },
        // --- фильтры каталога (см. память wedwibse-product: тип, чек, вместимость, расположение, назначение, особенности)
        {
          name: 'type', type: 'select', maxSelect: 1,
          values: ['restoran', 'banketnyj-zal', 'shater', 'veranda', 'restoran-pri-otele', 'zagorodnyj-klub', 'loft', 'oranzhereya', 'usadba', 'yaht-klub', 'drugoe'],
        },
        { name: 'capacityBanquet', type: 'number', min: 0, onlyInt: true },
        { name: 'capacityBuffet', type: 'number', min: 0, onlyInt: true },
        { name: 'checkFrom', type: 'number', min: 0, onlyInt: true },
        { name: 'rentFrom', type: 'number', min: 0, onlyInt: true },
        { name: 'kmFromMkad', type: 'number', min: 0 },
        {
          name: 'districts', type: 'select', maxSelect: 10,
          values: ['cao', 'sao', 'svao', 'vao', 'yuvao', 'yuao', 'yuzao', 'zao', 'szao', 'podmoskovie'],
        },
        { name: 'purposes', type: 'select', maxSelect: 4, values: ['svadba', 'korporativ', 'den-rozhdeniya', 'furshet'] },
        {
          name: 'features', type: 'select', maxSelect: 10,
          values: ['u-vody', 'svoj-alkogol', 'vyezdnaya-registraciya', 'za-gorodom', 'pod-zakrytie', 'prozhivanie', 'svoya-kuhnya', 'parkovka', 'terrasa', 'kejtering-lyuboj'],
        },
        { name: 'geo', type: 'json', maxSize: 2000 },
        { name: 'address', type: 'text', max: 300 },
        { name: 'phone', type: 'text', max: 40 },
        { name: 'email', type: 'email' },
        { name: 'site', type: 'url' },
        { name: 'rating', type: 'number', min: 0, max: 5 },
        { name: 'reviewsCount', type: 'number', min: 0, onlyInt: true },
        // --- тело страницы: полный объект Venue (blocks, scenes, terms, faq, seo…)
        { name: 'page', type: 'json', maxSize: 2000000 },
        // --- фото: оригиналы; в page пути вида /venues/<slug>/pNN.webp, сопоставляются по имени файла
        {
          name: 'photos', type: 'file', maxSelect: 99, maxSize: 15000000,
          mimeTypes: ['image/webp', 'image/jpeg', 'image/png'],
          thumbs: ['400x0', '800x0', '1200x0'],
          protected: false,
        },
        { name: 'docs', type: 'file', maxSelect: 10, maxSize: 30000000, mimeTypes: ['application/pdf'] },
        { name: 'source', type: 'text', max: 300 }, // откуда данные: строка таблицы, сайт
        { name: 'notes', type: 'editor' }, // служебные заметки менеджера, на сайт не идут
        { name: 'created', type: 'autodate', onCreate: true },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_venues_slug ON venues (citySlug, slug)',
        'CREATE INDEX idx_venues_filters ON venues (status, type, capacityBanquet, checkFrom)',
      ],
    });
    app.save(venues);

    // ---------- отзывы о площадках (2-й этап ТЗ: премодерация) ----------
    const reviews = new Collection({
      name: 'venue_reviews',
      type: 'base',
      listRule: 'approved = true',
      viewRule: 'approved = true',
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'venue', type: 'relation', required: true, collectionId: venues.id, maxSelect: 1, cascadeDelete: true },
        { name: 'author', type: 'text', required: true, max: 120 },
        { name: 'date', type: 'date' },
        { name: 'rating', type: 'number', required: true, min: 1, max: 5, onlyInt: true },
        { name: 'text', type: 'text', required: true, max: 4000 },
        { name: 'source', type: 'text', max: 120 }, // yandex-maps | site | own
        { name: 'approved', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_reviews_venue ON venue_reviews (venue, approved)'],
    });
    app.save(reviews);

    // ---------- подрядчики (та же система, что площадки, отличаются типом) ----------
    const specialists = new Collection({
      name: 'specialists',
      type: 'base',
      listRule: 'status = "published"',
      viewRule: 'status = "published"',
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'slug', type: 'text', required: true, min: 2, max: 80, pattern: '^[a-z0-9-]+$' },
        { name: 'status', type: 'select', required: true, maxSelect: 1, values: ['draft', 'review', 'published', 'archived'] },
        { name: 'categorySlug', type: 'text', required: true, max: 60 },
        { name: 'alsoCategories', type: 'json', maxSize: 2000 },
        { name: 'name', type: 'text', required: true, max: 120 },
        { name: 'tagline', type: 'text', max: 200 },
        { name: 'citySlug', type: 'text', required: true, max: 40 },
        { name: 'priceFrom', type: 'number', min: 0, onlyInt: true },
        { name: 'filters', type: 'json', maxSize: 4000 }, // значения фильтров категории (gender, style, experience…)
        { name: 'page', type: 'json', maxSize: 2000000 }, // полный объект Specialist
        { name: 'avatar', type: 'file', maxSelect: 1, maxSize: 5000000, mimeTypes: ['image/webp', 'image/jpeg', 'image/png'], thumbs: ['220x220', '440x440'] },
        { name: 'photos', type: 'file', maxSelect: 99, maxSize: 15000000, mimeTypes: ['image/webp', 'image/jpeg', 'image/png'], thumbs: ['400x0', '800x0', '1200x0'] },
        { name: 'reels', type: 'file', maxSelect: 20, maxSize: 4000000, mimeTypes: ['video/mp4'] },
        { name: 'source', type: 'text', max: 300 },
        { name: 'notes', type: 'editor' },
        { name: 'created', type: 'autodate', onCreate: true },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_specialists_slug ON specialists (categorySlug, slug)'],
    });
    app.save(specialists);

    // ---------- заявки: клиенты и подрядчики раздельно (kind), создавать может любой, читать — никто ----------
    const leads = new Collection({
      name: 'leads',
      type: 'base',
      listRule: null,
      viewRule: null,
      createRule: '',
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'kind', type: 'select', required: true, maxSelect: 1, values: ['client', 'vendor'] },
        { name: 'name', type: 'text', required: true, max: 120 },
        { name: 'phone', type: 'text', required: true, max: 40 },
        { name: 'email', type: 'email' },
        { name: 'message', type: 'text', max: 4000 },
        { name: 'venue', type: 'relation', collectionId: venues.id, maxSelect: 1 },
        { name: 'specialist', type: 'relation', collectionId: specialists.id, maxSelect: 1 },
        { name: 'eventDate', type: 'date' },
        { name: 'guests', type: 'number', min: 0, onlyInt: true },
        { name: 'sourceUrl', type: 'url' },
        { name: 'consent', type: 'bool', required: true }, // согласие на обработку ПД — без него запись не создаётся
        { name: 'status', type: 'select', maxSelect: 1, values: ['new', 'in-progress', 'done', 'spam'] },
        { name: 'created', type: 'autodate', onCreate: true },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_leads_status ON leads (status, created)'],
    });
    app.save(leads);

    // ---------- посадочные страницы (главный SEO-инструмент: текст под запрос + фильтр каталога) ----------
    const landings = new Collection({
      name: 'landing_pages',
      type: 'base',
      listRule: 'status = "published"',
      viewRule: 'status = "published"',
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'path', type: 'text', required: true, max: 200 }, // /moskva/ploshchadki/shatry/
        { name: 'status', type: 'select', required: true, maxSelect: 1, values: ['draft', 'published'] },
        { name: 'citySlug', type: 'text', required: true, max: 40 },
        { name: 'section', type: 'select', required: true, maxSelect: 1, values: ['ploshchadki', 'podryadchiki'] },
        { name: 'title', type: 'text', required: true, max: 200 },
        { name: 'h1', type: 'text', required: true, max: 200 },
        { name: 'description', type: 'text', max: 300 },
        { name: 'intro', type: 'editor' }, // текст над списком
        { name: 'outro', type: 'editor' }, // текст под списком
        { name: 'filter', type: 'json', maxSize: 4000 }, // предустановленный фильтр каталога
        { name: 'links', type: 'json', maxSize: 8000 }, // ссылки на более узкие посадочные
        { name: 'created', type: 'autodate', onCreate: true },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_landing_path ON landing_pages (path)'],
    });
    app.save(landings);
  },
  (app) => {
    for (const name of ['leads', 'landing_pages', 'venue_reviews', 'specialists', 'venues']) {
      const c = app.findCollectionByNameOrId(name);
      if (c) app.delete(c);
    }
  }
);
