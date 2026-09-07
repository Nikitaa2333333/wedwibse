// ============================================================
// КНОПКА «В ИЗБРАННОЕ» — одна привязка на все страницы.
// Разметка кнопки везде одинаковая: <button class="save" data-save='{…}'>,
// снимок карточки лежит строкой в data-save. Раньше эти пять строк жили
// копией в каждом каталоге; страница теперь только зовёт bindSaveButtons().
// Появится новая категория подрядчиков — её каталог не пишет свою копию.
// ============================================================
import { toggleFavorite, isFavorited, type FavoriteItem } from './favorites';

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
      btn.setAttribute('aria-pressed', String(toggleFavorite(item)));
    });
  });
}
