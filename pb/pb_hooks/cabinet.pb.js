/// <reference path="../pb_data/types.d.ts" />
// Кабинет подрядчика: правила записи, модерация, маршруты /api/wed.
// Логика — в lib/cabinet.js (обработчики исполняются в изолированных VM
// и видят только то, что подключили сами через require).
// Запуск: pocketbase serve --hooksDir pb/pb_hooks (см. pb/README.md).

// ---------- ревизии ----------
onRecordCreateRequest((e) => {
  if (e.hasSuperuserAuth()) return e.next();
  return require(`${__hooks}/lib/cabinet.js`).vendorCreateRevision(e);
}, 'revisions');

onRecordUpdateRequest((e) => {
  const cab = require(`${__hooks}/lib/cabinet.js`);
  return cab.isModerator(e) ? cab.moderateRevision(e) : cab.vendorUpdateRevision(e);
}, 'revisions');

// ---------- карточки из кабинета → выкладка сайта ----------
// после записи (одобрение — уже после транзакции): решение модератора
// или снятие карточки в админке базы сразу запускает деплой
onRecordAfterCreateSuccess((e) => require(`${__hooks}/lib/cabinet.js`).cardSaved(e), 'specialists');
onRecordAfterUpdateSuccess((e) => require(`${__hooks}/lib/cabinet.js`).cardSaved(e), 'specialists');
onRecordAfterDeleteSuccess((e) => require(`${__hooks}/lib/cabinet.js`).cardDeleted(e), 'specialists');
// площадки: только очередь нарезки фото (сервис фото, 07.11.2026)
onRecordAfterCreateSuccess((e) => require(`${__hooks}/lib/cabinet.js`).cardSaved(e), 'venues');
onRecordAfterUpdateSuccess((e) => require(`${__hooks}/lib/cabinet.js`).cardSaved(e), 'venues');

// ---------- видео ----------
onRecordCreateRequest((e) => {
  if (e.hasSuperuserAuth()) return e.next();
  return require(`${__hooks}/lib/cabinet.js`).vendorCreateVideoRequest(e);
}, 'video_requests');

// ---------- заявки пар (форма на карточке, BookingSheet) ----------
// Запись в leads закрыта (createRule = null, миграция stage2) — только этот
// маршрут: проверяет поля, ставит статус и шлёт заявку в группу модерации.
routerAdd('POST', '/api/wed/lead', (e) => require(`${__hooks}/lib/cabinet.js`).createLead(e));

// ---------- отзывы невест (12.11.2026, lib/reviews.js) ----------
onRecordCreateRequest((e) => {
  if (e.hasSuperuserAuth()) return e.next();
  return require(`${__hooks}/lib/reviews.js`).brideCreateReview(e);
}, 'reviews');

onRecordUpdateRequest((e) => {
  if (e.hasSuperuserAuth()) return e.next();
  return require(`${__hooks}/lib/reviews.js`).moderateReview(e);
}, 'reviews');

// вход невесты: почта (дальше штатный request-otp), Telegram, MAX
routerAdd('POST', '/api/wed/bride/email', (e) => require(`${__hooks}/lib/cabinet.js`).brideEmail(e));
routerAdd('POST', '/api/wed/bride/telegram', (e) => require(`${__hooks}/lib/cabinet.js`).brideTelegram(e));
routerAdd('POST', '/api/wed/bride/max', (e) => require(`${__hooks}/lib/cabinet.js`).brideMax(e));

// ---------- учётки ----------
onRecordCreateRequest((e) => {
  if (e.hasSuperuserAuth()) return e.next();
  return require(`${__hooks}/lib/cabinet.js`).vendorCreateAccount(e);
}, 'vendors');

onRecordUpdateRequest((e) => {
  if (e.hasSuperuserAuth()) return e.next();
  return require(`${__hooks}/lib/cabinet.js`).vendorUpdateAccount(e);
}, 'vendors');

// ---------- маршруты ----------
// модератор: удалить новую карточку / правку, снять карточку с сайта, удалить снятую
routerAdd('POST', '/api/wed/mod/remove', (e) => require(`${__hooks}/lib/cabinet.js`).modRemove(e), $apis.requireAuth('moderators'));

routerAdd('POST', '/api/wed/edit', (e) => require(`${__hooks}/lib/cabinet.js`).startEdit(e), $apis.requireAuth('vendors'));

// фото по ссылке на Яндекс Диск: показать кадры папки, забрать выбранные (lib/yadisk.js)
routerAdd('GET', '/api/wed/yadisk/list', (e) => require(`${__hooks}/lib/yadisk.js`).list(e), $apis.requireAuth('vendors'));
routerAdd('POST', '/api/wed/yadisk/import', (e) => require(`${__hooks}/lib/yadisk.js`).importPhotos(e), $apis.requireAuth('vendors'));

routerAdd('GET', '/api/wed/slug', (e) => require(`${__hooks}/lib/cabinet.js`).checkSlug(e), $apis.requireAuth('vendors'));

// вход и регистрация через Telegram (виджет входа), погашение приглашения
routerAdd('POST', '/api/wed/telegram', (e) => require(`${__hooks}/lib/cabinet.js`).telegramAuth(e));

// превью анкеты до одобрения: ссылка автору и данные для серверной страницы
routerAdd('POST', '/api/wed/preview-link', (e) => require(`${__hooks}/lib/cabinet.js`).previewLink(e), $apis.requireAuth('vendors'));
routerAdd('GET', '/api/wed/preview', (e) => require(`${__hooks}/lib/cabinet.js`).previewData(e));
routerAdd('GET', '/api/wed/preview-file', (e) => require(`${__hooks}/lib/cabinet.js`).previewFile(e));

// вход через MAX: код → бот (вебхук подтверждает аккаунт) → вход (lib/max.js)
routerAdd('POST', '/api/wed/max/start', (e) => require(`${__hooks}/lib/max.js`).start(e));
routerAdd('POST', '/api/wed/max/webhook', (e) => require(`${__hooks}/lib/max.js`).webhook(e));
routerAdd('POST', '/api/wed/max', (e) => require(`${__hooks}/lib/cabinet.js`).maxAuth(e));
// «Подключить» из профиля: второй мессенджер к той же учётке
routerAdd('POST', '/api/wed/link', (e) => require(`${__hooks}/lib/cabinet.js`).linkMessenger(e), $apis.requireAuth('vendors'));

// вход по почте: регистрация с условиями, сброс пароля кодом из письма
// (сам код — штатный request-otp / auth-with-otp)
routerAdd('POST', '/api/wed/register', (e) => require(`${__hooks}/lib/cabinet.js`).emailRegister(e));
routerAdd('POST', '/api/wed/confirm', (e) => require(`${__hooks}/lib/cabinet.js`).confirmCode(e));
routerAdd('POST', '/api/wed/password-reset', (e) => require(`${__hooks}/lib/cabinet.js`).passwordReset(e));

routerAdd('POST', '/api/wed/invite', (e) => require(`${__hooks}/lib/cabinet.js`).claimInviteRoute(e), $apis.requireAuth('vendors'));

// мои карточки: опубликованные (с владельцем) — у подрядчика нет доступа
// к закрытым полям карточки, список отдаёт маршрут
routerAdd('GET', '/api/wed/my-cards', (e) => require(`${__hooks}/lib/cabinet.js`).myCards(e), $apis.requireAuth('vendors'));
// заявки на мои карточки — ВРЕМЕННО, на время показа (lib/cabinet.js, LEADS_TO_VENDORS)
routerAdd('GET', '/api/wed/my-leads', (e) => require(`${__hooks}/lib/cabinet.js`).myLeads(e), $apis.requireAuth('vendors'));

// ---------- статистика карточек (14.11.2026, lib/stats.js, docs/cabinet/STATS.md) ----------
// сердце «в избранное» на сайте — +1 к счётчику дня (sendBeacon, без учётки)
routerAdd('POST', '/api/wed/hit', (e) => require(`${__hooks}/lib/stats.js`).hit(e));
// подрядчик — свои карточки; модератор — все; досчёт истории из Метрики
routerAdd('GET', '/api/wed/my-stats', (e) => require(`${__hooks}/lib/stats.js`).myStats(e), $apis.requireAuth('vendors'));
routerAdd('GET', '/api/wed/mod/stats', (e) => require(`${__hooks}/lib/stats.js`).modStats(e), $apis.requireAuth('moderators', '_superusers'));
routerAdd('POST', '/api/wed/mod/stats-sync', (e) => require(`${__hooks}/lib/stats.js`).syncRoute(e), $apis.requireAuth('moderators', '_superusers'));
// Метрика → card_stats раз в час (вчера и сегодня); без METRIKA_TOKEN молчит
cronAdd('wed-stats-metrika', '17 * * * *', () => require(`${__hooks}/lib/stats.js`).cron());
