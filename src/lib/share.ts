// ============================================================
// «ПОДЕЛИТЬСЯ» — одна кнопка на все карточки проекта (площадка,
// подрядчик, дальше — любая новая категория). Логика одна, поэтому
// живёт здесь, а не копией в каждой странице (как bindSaveButtons).
//
// Телефон — главная сцена, и там есть системный лист «Поделиться»
// (navigator.share): он умнее любого нашего меню — знает мессенджеры
// человека, его контакты и порядок. Своего меню со ссылками на соцсети
// не делаем.
//
// На десктопе листа нет: там кнопка кладёт адрес в буфер и на пару
// секунд превращается в галочку. Отдельного всплывающего сообщения
// («Скопировано») нет: смена значка в той же кнопке — ответ на месте,
// без слоя поверх страницы.
// ============================================================

/** сколько держится галочка после копирования */
const DONE_MS = 2000;

export function bindShareButtons(root: ParentNode = document): void {
  root.querySelectorAll<HTMLButtonElement>('[data-share]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const url = location.href;
      const title = document.title;

      // Системный лист. Отказ пользователя (AbortError) — не ошибка:
      // просто ничего не делаем, в буфер при этом не лезем.
      if (navigator.share) {
        try {
          await navigator.share({ title, url });
          return;
        } catch {
          return;
        }
      }

      try {
        await navigator.clipboard.writeText(url);
        markDone(btn);
      } catch {
        // Буфер недоступен (нет разрешения, http): молча ничего не
        // обещаем — ложная галочка хуже отсутствия реакции.
      }
    });
  });
}

function markDone(btn: HTMLButtonElement): void {
  btn.dataset.shareDone = '';
  window.setTimeout(() => {
    delete btn.dataset.shareDone;
  }, DONE_MS);
}
