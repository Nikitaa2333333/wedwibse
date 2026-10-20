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
  return e.hasSuperuserAuth() ? cab.moderateRevision(e) : cab.vendorUpdateRevision(e);
}, 'revisions');

// ---------- видео ----------
onRecordCreateRequest((e) => {
  if (e.hasSuperuserAuth()) return e.next();
  return require(`${__hooks}/lib/cabinet.js`).vendorCreateVideoRequest(e);
}, 'video_requests');

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
routerAdd('POST', '/api/wed/edit', (e) => require(`${__hooks}/lib/cabinet.js`).startEdit(e), $apis.requireAuth('vendors'));

routerAdd('GET', '/api/wed/slug', (e) => require(`${__hooks}/lib/cabinet.js`).checkSlug(e), $apis.requireAuth('vendors'));
