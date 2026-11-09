/// <reference path="../pb_data/types.d.ts" />
// ============================================================
// ЗАМЕЧАНИЯ МОДЕРАТОРА К КАДРАМ (решение Никиты 05.11.2026, простой вариант).
//
// Возвращая карточку, модератор пишет причину (rejectReason, как было) и
// может отметить кадры, которые надо заменить: revisions.remarkPhotos —
// имена файлов из photos. Подрядчик видит их в красной рамке; заменил или
// убрал кадр — имени больше нет в photos, замечание снято само.
// Пишет только модератор (хук moderateRevision); у подрядчика поля нет
// в белом списке кабинета. Разделов и типовых причин нет — сознательно.
// ============================================================

migrate(
  (app) => {
    const revisions = app.findCollectionByNameOrId('revisions');
    revisions.fields.add(new JSONField({ name: 'remarkPhotos', maxSize: 20000 }));
    app.save(revisions);
  },
  (app) => {
    const revisions = app.findCollectionByNameOrId('revisions');
    revisions.fields.removeByName('remarkPhotos');
    app.save(revisions);
  }
);
