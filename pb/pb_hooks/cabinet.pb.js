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

// ---------- видео ----------
onRecordCreateRequest((e) => {
  if (e.hasSuperuserAuth()) return e.next();
  return require(`${__hooks}/lib/cabinet.js`).vendorCreateVideoRequest(e);
}, 'video_requests');

// ---------- заявки пар (форма на карточке, BookingSheet) ----------
// Запись в leads закрыта (createRule = null, миграция stage2) — только этот
// маршрут: проверяет поля, ставит статус и шлёт заявку в группу модерации.
routerAdd('POST', '/api/wed/lead', (e) => require(`${__hooks}/lib/cabinet.js`).createLead(e));

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

// вход через MAX: код → бот (вебхук подтверждает аккаунт) → вход (lib/max.js)
routerAdd('POST', '/api/wed/max/start', (e) => require(`${__hooks}/lib/max.js`).start(e));
routerAdd('POST', '/api/wed/max/webhook', (e) => require(`${__hooks}/lib/max.js`).webhook(e));
routerAdd('POST', '/api/wed/max', (e) => require(`${__hooks}/lib/cabinet.js`).maxAuth(e));

// вход по почте: регистрация с условиями, сброс пароля кодом из письма
// (сам код — штатный request-otp / auth-with-otp)
routerAdd('POST', '/api/wed/register', (e) => require(`${__hooks}/lib/cabinet.js`).emailRegister(e));
routerAdd('POST', '/api/wed/confirm', (e) => require(`${__hooks}/lib/cabinet.js`).confirmCode(e));
routerAdd('POST', '/api/wed/password-reset', (e) => require(`${__hooks}/lib/cabinet.js`).passwordReset(e));

routerAdd('POST', '/api/wed/invite', (e) => require(`${__hooks}/lib/cabinet.js`).claimInviteRoute(e), $apis.requireAuth('vendors'));

// мои карточки: опубликованные (с владельцем) — у подрядчика нет доступа
// к закрытым полям карточки, список отдаёт маршрут
routerAdd('GET', '/api/wed/my-cards', (e) => require(`${__hooks}/lib/cabinet.js`).myCards(e), $apis.requireAuth('vendors'));
