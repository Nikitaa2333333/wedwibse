/// <reference path="../pb_data/types.d.ts" />
// reels у площадок: ролики из материалов площадки (лупы по VIDEO.md,
// public/venues/<slug>/reel-NN.mp4), запись о них — в data/reels.ts с
// venue: <slug>. У подрядчиков поле было с первой миграции, у площадок
// видео появилось позже (14.09.2026) — доводим схему до зеркала.
// Имя файла в PB → исходный путь пишется в тот же photoIndex.
migrate(
  (app) => {
    const c = app.findCollectionByNameOrId('venues');
    c.fields.add(new FileField({
      name: 'reels', maxSelect: 20, maxSize: 4000000, mimeTypes: ['video/mp4'],
    }));
    app.save(c);
  },
  (app) => {
    const c = app.findCollectionByNameOrId('venues');
    c.fields.removeByName('reels');
    app.save(c);
  }
);
