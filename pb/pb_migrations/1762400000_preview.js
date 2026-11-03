/// <reference path="../pb_data/types.d.ts" />
// ============================================================
// ПРЕВЬЮ АНКЕТЫ ДО ОДОБРЕНИЯ (STAGE2.md, 03.11).
//
// Фото анкеты закрыты, превью читает их ключом владельца (newFileToken).
// По умолчанию ключ живёт 3 минуты — превью грузит кадры по мере прокрутки,
// и нижние уже не открывались бы. Час: на столько же ссылок на превью
// хватает с запасом (ссылка — 15 минут).
// ============================================================

migrate(
  (app) => {
    const vendors = app.findCollectionByNameOrId('vendors');
    vendors.fileToken = { duration: 3600 };
    app.save(vendors);
  },
  (app) => {
    const vendors = app.findCollectionByNameOrId('vendors');
    vendors.fileToken = { duration: 180 };
    app.save(vendors);
  }
);
