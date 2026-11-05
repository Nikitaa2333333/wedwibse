/// <reference path="../pb_data/types.d.ts" />
// ============================================================
// КУДА ПРИСЫЛАТЬ ЗАЯВКИ — настройки оповещений подрядчика (02.11.2026).
//
// vendors.notify = { telegram: bool, max: bool, email: bool, emailTo: string }
// Подрядчик меняет сам (хук: белый список + проверка формы). Telegram и MAX
// работают только при подключённом входе (telegramId / maxId) — бот пишет
// лишь тем, кто к нему приходил. Сама доставка — когда заявки начнём
// передавать подрядчикам (docs/cabinet/CABINET.md, открытые решения, п. 3).
// ============================================================

migrate(
  (app) => {
    const vendors = app.findCollectionByNameOrId('vendors');
    if (!vendors.fields.getByName('notify')) vendors.fields.add(new JSONField({ name: 'notify', maxSize: 2000 }));
    app.save(vendors);
  },
  (app) => {
    const vendors = app.findCollectionByNameOrId('vendors');
    vendors.fields.removeByName('notify');
    app.save(vendors);
  }
);
