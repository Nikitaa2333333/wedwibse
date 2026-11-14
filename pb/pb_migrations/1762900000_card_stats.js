/// <reference path="../pb_data/types.d.ts" />
// СТАТИСТИКА КАРТОЧЕК (14.11.2026, docs/cabinet/STATS.md) — задание Евгения:
// подрядчику и админке видеть переходы, избранное и заявки по дням.
//
//   card_stats — одна строка на «карточка × день» (день по Москве, YYYY-MM-DD):
//     views, visitors — просмотры и посетители страницы карточки из Метрики
//                       (хук stats.js забирает их раз в час и при досчёте);
//     src             — заходы, начавшиеся с карточки, по источникам Метрики
//                       { organic: 3, direct: 1, internal: 5, … };
//     favs            — «добавили в избранное»: свой счётчик (POST /api/wed/hit),
//                       Метрика избранное не видит — оно живёт в браузере пары.
//   Заявки сюда не пишем — они уже в leads (связь venue / specialist + created),
//   считаем их на лету в /api/wed/my-stats и /api/wed/mod/stats.
//
// Пишет только хук (create/update/delete закрыты). Читает модератор — всё,
// подрядчик — строки своих карточек (owner карточки).
const MOD = '@request.auth.collectionName = "moderators"';
const OWNER = '(venue.owner = @request.auth.id || specialist.owner = @request.auth.id)';

migrate(
  (app) => {
    const venues = app.findCollectionByNameOrId('venues');
    const specialists = app.findCollectionByNameOrId('specialists');
    const stats = new Collection({
      name: 'card_stats',
      type: 'base',
      listRule: `${MOD} || (@request.auth.collectionName = "vendors" && ${OWNER})`,
      viewRule: `${MOD} || (@request.auth.collectionName = "vendors" && ${OWNER})`,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'venue', type: 'relation', collectionId: venues.id, maxSelect: 1, cascadeDelete: true },
        { name: 'specialist', type: 'relation', collectionId: specialists.id, maxSelect: 1, cascadeDelete: true },
        { name: 'day', type: 'text', required: true, max: 10, pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' },
        { name: 'views', type: 'number', min: 0, onlyInt: true },
        { name: 'visitors', type: 'number', min: 0, onlyInt: true },
        { name: 'favs', type: 'number', min: 0, onlyInt: true },
        { name: 'src', type: 'json', maxSize: 2000 },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_card_stats_venue_day ON card_stats (venue, day) WHERE venue != ""',
        'CREATE UNIQUE INDEX idx_card_stats_specialist_day ON card_stats (specialist, day) WHERE specialist != ""',
        'CREATE INDEX idx_card_stats_day ON card_stats (day)',
      ],
    });
    app.save(stats);

    // счётчик избранного: частота с одного адреса (сердце не жмут 60 раз в минуту)
    const s = app.settings();
    if (!s.rateLimits.rules.some((r) => r.label === 'POST /api/wed/hit')) {
      s.rateLimits.rules.push({ label: 'POST /api/wed/hit', maxRequests: 60, duration: 60, audience: '' });
    }
    app.save(s);
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('card_stats'));
    } catch (_) {}
    const s = app.settings();
    s.rateLimits.rules = s.rateLimits.rules.filter((r) => r.label !== 'POST /api/wed/hit');
    app.save(s);
  }
);
