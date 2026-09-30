// ============================================================
// КНОПКА «В ИЗБРАННОЕ» — одна привязка на все страницы.
// Разметка кнопки везде одинаковая: <button class="save" data-save='{…}'>,
// снимок карточки лежит строкой в data-save. Раньше эти пять строк жили
// копией в каждом каталоге; страница теперь только зовёт bindSaveButtons().
// Появится новая категория подрядчиков — её каталог не пишет свою копию.
// ============================================================
import { toggleFavorite, isFavorited, type FavoriteItem } from './favorites';
import { showFavToast, hideFavToast } from './fav-toast';

/**
 * Оживляет все кнопки [data-save] внутри root.
 * Вызывать повторно безопасно: уже привязанные кнопки пропускаются —
 * страница может позвать привязку ещё раз после дорисовки карточек.
 */
export function bindSaveButtons(root: ParentNode = document): void {
  root.querySelectorAll<HTMLButtonElement>('[data-save]').forEach((btn) => {
    if (btn.dataset.saveBound) return;
    btn.dataset.saveBound = '1';

    const item = JSON.parse(btn.dataset.save!) as FavoriteItem;
    btn.setAttribute('aria-pressed', String(isFavorited(item.id)));

    btn.addEventListener('click', () => {
      const nowSaved = toggleFavorite(item);
      // Плашка-пуш снизу — только на добавление; убрали — прячем её.
      if (nowSaved) showFavToast();
      else hideFavToast();
      const saved = String(nowSaved);
      // Одна карточка — несколько кнопок (сердце на кадре и «В избранное»
      // под именем): все они показывают одно состояние.
      document.querySelectorAll<HTMLElement>('[data-save-bound]').forEach((b) => {
        if (b === btn || (JSON.parse(b.dataset.save!) as FavoriteItem).id === item.id) {
          b.setAttribute('aria-pressed', saved);
        }
      });
    });
  });
}
