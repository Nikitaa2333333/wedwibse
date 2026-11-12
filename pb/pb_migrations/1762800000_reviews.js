/// <reference path="../pb_data/types.d.ts" />
// ============================================================
// ОТЗЫВЫ НЕВЕСТ (решение Никиты 12.11.2026, docs/cabinet/REVIEWS.md).
//
// Отзывы с Яндекс Карт с сайта сняты целиком, вместе с оценками. Теперь
// отзыв пишет только невеста со своей учёткой (brides): о площадке или
// о подрядчике, оценка 1–5, текст, месяц свадьбы, до 5 фото. Отзыв уходит
// на модерацию (status = pending) и виден на сайте только после одобрения.
//
//   reviews        — сами отзывы. Пишет невеста (createRule — только brides,
//                    поля и статус ставит хук lib/reviews.js), решает модератор
//                    (updateRule — только moderators, хук пускает лишь status
//                    и rejectReason). Опубликованные открыты всем: их читает
//                    сайт (live-data) и кабинет подрядчика.
//   venue_reviews  — заготовка 1-го этапа под отзывы с Карт, пустая: удалена.
//   brides         — + maxId и telegramId: вход невесты через MAX и Telegram,
//                    как у подрядчика (маршруты /api/wed/bride/*).
// ============================================================

const MOD = '@request.auth.collectionName = "moderators"';
const BRIDE = '@request.auth.collectionName = "brides"';

migrate(
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('venue_reviews'));
    } catch (_) {}

    const brides = app.findCollectionByNameOrId('brides');
    brides.fields.add(new TextField({ name: 'telegramId', max: 20, pattern: '^[0-9]*$' }));
    brides.fields.add(new TextField({ name: 'maxId', max: 20, pattern: '^[0-9]*$' }));
    brides.addIndex('idx_brides_telegram', true, 'telegramId', 'telegramId != ""');
    brides.addIndex('idx_brides_max', true, 'maxId', 'maxId != ""');
    // учётке из мессенджера почта не нужна
    brides.fields.getByName('email').required = false;
    // модератор видит автора отзыва (почту) на экране модерации
    brides.listRule = `id = @request.auth.id || ${MOD}`;
    brides.viewRule = `id = @request.auth.id || ${MOD}`;
    app.save(brides);

    const venues = app.findCollectionByNameOrId('venues');
    const specialists = app.findCollectionByNameOrId('specialists');

    const reviews = new Collection({
      name: 'reviews',
      type: 'base',
      listRule: `status = "approved" || (${BRIDE} && bride = @request.auth.id) || ${MOD}`,
      viewRule: `status = "approved" || (${BRIDE} && bride = @request.auth.id) || ${MOD}`,
      createRule: BRIDE,
      updateRule: MOD,
      // невеста может снять свой отзыв сама (в любом статусе), модератор — любой
      deleteRule: `(${BRIDE} && bride = @request.auth.id) || ${MOD}`,
      fields: [
        { name: 'bride', type: 'relation', required: true, collectionId: brides.id, maxSelect: 1, cascadeDelete: true },
        { name: 'venue', type: 'relation', collectionId: venues.id, maxSelect: 1, cascadeDelete: true },
        { name: 'specialist', type: 'relation', collectionId: specialists.id, maxSelect: 1, cascadeDelete: true },
        // имя под отзывом: как невеста подписалась, не данные учётки
        { name: 'authorName', type: 'text', required: true, max: 80 },
        { name: 'rating', type: 'number', required: true, min: 1, max: 5, onlyInt: true },
        { name: 'text', type: 'text', required: true, max: 4000 },
        // месяц свадьбы, «2026-08»
        { name: 'weddingMonth', type: 'text', max: 7, pattern: '^$|^[0-9]{4}-(0[1-9]|1[0-2])$' },
        {
          name: 'photos', type: 'file', maxSelect: 5, maxSize: 15000000,
          mimeTypes: ['image/webp', 'image/jpeg', 'image/png', 'image/heic', 'image/heif'],
          thumbs: ['480x0', '1200x0'],
        },
        { name: 'status', type: 'select', required: true, maxSelect: 1, values: ['pending', 'approved', 'rejected'] },
        { name: 'rejectReason', type: 'text', max: 1000 },
        { name: 'reviewedAt', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_reviews_status ON reviews (status, created)',
        'CREATE INDEX idx_reviews_venue ON reviews (venue, status)',
        'CREATE INDEX idx_reviews_specialist ON reviews (specialist, status)',
        // один отзыв невесты на карточку
        'CREATE UNIQUE INDEX idx_reviews_bride_venue ON reviews (bride, venue) WHERE venue != ""',
        'CREATE UNIQUE INDEX idx_reviews_bride_specialist ON reviews (bride, specialist) WHERE specialist != ""',
      ],
    });
    app.save(reviews);
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('reviews'));
    } catch (_) {}
    const brides = app.findCollectionByNameOrId('brides');
    brides.removeIndex('idx_brides_telegram');
    brides.removeIndex('idx_brides_max');
    brides.fields.removeByName('telegramId');
    brides.fields.removeByName('maxId');
    brides.listRule = 'id = @request.auth.id';
    brides.viewRule = 'id = @request.auth.id';
    app.save(brides);
  }
);
