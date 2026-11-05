/// <reference path="../pb_data/types.d.ts" />
// ============================================================
// ФОТО С ЯНДЕКС ДИСКА БЕЗ ДУБЛЕЙ (прогон на живом 05.11.2026).
//
// Связь оборвалась посреди пачки — сервер её всё равно дозабирает, а экран
// оставляет кадры отмеченными, и повторное «Забрать» привозило те же фото
// второй раз. revisions.yadisk — { "<путь на диске>": "<имя файла в photos>" }:
// хук не берёт путь повторно, пока его файл в карточке (удалили фото —
// можно забрать снова). Пишет только хук (lib/yadisk.js): поля нет в белом
// списке кабинета, подрядчик его не передаст; скрыто из ответов API.
// ============================================================

migrate(
  (app) => {
    const revisions = app.findCollectionByNameOrId('revisions');
    revisions.fields.add(new JSONField({ name: 'yadisk', hidden: true, maxSize: 200000 }));
    app.save(revisions);
  },
  (app) => {
    const revisions = app.findCollectionByNameOrId('revisions');
    revisions.fields.removeByName('yadisk');
    app.save(revisions);
  }
);
