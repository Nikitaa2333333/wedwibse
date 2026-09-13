/// <reference path="../pb_data/types.d.ts" />
// photoIndex: { "<имя файла в PocketBase>": "/venues/<slug>/gal/g4.webp" }.
// PocketBase переименовывает загруженные файлы (дефисы и слэши → «_»,
// плюс случайный суффикс), обратно исходный путь из имени не восстановить,
// а именно по исходным путям на кадры ссылается page (Venue). Индекс
// пишет pb-seed после загрузки, читает pb-pull при сборке.
migrate(
  (app) => {
    for (const name of ['venues', 'specialists']) {
      const c = app.findCollectionByNameOrId(name);
      c.fields.add(new JSONField({ name: 'photoIndex', maxSize: 200000 }));
      app.save(c);
    }
  },
  (app) => {
    for (const name of ['venues', 'specialists']) {
      const c = app.findCollectionByNameOrId(name);
      c.fields.removeByName('photoIndex');
      app.save(c);
    }
  }
);
