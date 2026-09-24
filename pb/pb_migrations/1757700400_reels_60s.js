/// <reference path="../pb_data/types.d.ts" />
// Потолок файла ролика 4 → 10 МБ у подрядчиков и площадок. С 24.09.2026
// ролик — не 8-секундный луп, а до 60 секунд (VIDEO.md, цель до 8 МБ),
// и pb-seed упёрся в лимит на первом же минутном ролике.
const COLLECTIONS = ['specialists', 'venues'];
migrate(
  (app) => {
    for (const name of COLLECTIONS) {
      const c = app.findCollectionByNameOrId(name);
      c.fields.getByName('reels').maxSize = 10000000;
      app.save(c);
    }
  },
  (app) => {
    for (const name of COLLECTIONS) {
      const c = app.findCollectionByNameOrId(name);
      c.fields.getByName('reels').maxSize = 4000000;
      app.save(c);
    }
  }
);
