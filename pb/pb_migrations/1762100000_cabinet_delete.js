/// <reference path="../pb_data/types.d.ts" />
// ============================================================
// УДАЛЕНИЕ КАРТОЧКИ ИЗ КАБИНЕТА (Евгений, 02.11.2026).
//
// Было: подрядчик удалял только черновик. Тестовые карточки, вернувшиеся
// с причиной, удалить было нельзя. Теперь — черновик или «вернули».
// С проверки кабинет сперва отзывает (review → draft), потом удаляет.
// Одобренная ревизия — история карточки, её не трогаем.
// ============================================================

migrate(
  (app) => {
    const revisions = app.findCollectionByNameOrId('revisions');
    revisions.deleteRule = 'owner = @request.auth.id && (status = "draft" || status = "rejected")';
    app.save(revisions);
  },
  (app) => {
    const revisions = app.findCollectionByNameOrId('revisions');
    revisions.deleteRule = 'owner = @request.auth.id && status = "draft"';
    app.save(revisions);
  }
);
