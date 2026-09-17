/// <reference path="../pb_data/types.d.ts" />
// Потолок фото у площадки 99 → 300. Усадьба Гребнево (17.09.2026) — одна
// карточка каталога с девятью залами, у каждого свой рельс кадров: 102
// файла на запись, и pb-seed упёрся в maxSelect. Комплексы с несколькими
// залами в каталоге будут и дальше, а доска по правилу скилла — «весь
// материал площадки», не второй отбор.
migrate(
  (app) => {
    const c = app.findCollectionByNameOrId('venues');
    const f = c.fields.getByName('photos');
    f.maxSelect = 300;
    app.save(c);
  },
  (app) => {
    const c = app.findCollectionByNameOrId('venues');
    const f = c.fields.getByName('photos');
    f.maxSelect = 99;
    app.save(c);
  }
);
