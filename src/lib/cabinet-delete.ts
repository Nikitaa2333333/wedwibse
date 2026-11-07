// УДАЛЕНИЕ КАРТОЧКИ подрядчиком — одно окно на кабинет (05.11.2026).
// Никита: «Удалить карточку» стояла под «Отправить на проверку» — рядом
// с главным действием её легко нажать случайно. Теперь кнопка живёт в
// «Профиле», внизу. Отменить удаление нельзя (ревизия и фото стираются
// в базе), поэтому подтверждение с последствиями и кнопки, называющие
// выбор: «Удалить карточку» / «Оставить» (правила 10–11 скилла cabinet-ui).
// Удалить можно только новую карточку, ещё не опубликованную; с проверки
// её сначала отзываем — это делает само окно.
import { api, esc, errText } from './cabinet-api';
import { openDialog } from './cab-ui';
import { textLength, NBSP } from './cabinet-form';

export function confirmDelete(rev: any, onDone: () => void) {
  const title = String(rev.data?.name || '').trim() || 'карточку без названия';
  const n = (rev.photos ?? []).length;
  const lose = [n && `${n}${NBSP}фото`, textLength(rev.data ?? {}) && 'текст', 'ответы анкеты'].filter(Boolean).join(', ');
  // окно-предупреждение по HIG (Alerts), как alertBox: узкое по центру, заголовок и последствия,
  // кнопки одной ширины столбиком; без крестика — выбор называют кнопки (Никита 07.11: «не в нашем стиле»)
  const { dlg } = openDialog({
    cls: 'c-alert',
    html: `<div class="c-dialog__body">
      <h2 class="a-h2">Удалить «${esc(title)}»?</h2>
      <p>Пропадут ${lose}. Вернуть карточку будет нельзя</p>
      <p class="c-error" data-del-error hidden></p>
      <div class="c-alert__acts">
        <button class="a-btn a-btn--lg c-btn-danger" type="button" data-del-ok>Удалить карточку</button>
        <button class="a-btn a-btn--lg" type="button" data-close>Оставить</button>
      </div>
    </div>`,
  });
  dlg.querySelector<HTMLButtonElement>('[data-del-ok]')!.addEventListener('click', async (e) => {
    const b = e.currentTarget as HTMLButtonElement;
    b.disabled = true;
    b.textContent = 'Удаляем…';
    try {
      if (rev.status === 'review') await api('vendor', 'PATCH', `/api/collections/revisions/records/${rev.id}`, { status: 'draft' });
      await api('vendor', 'DELETE', `/api/collections/revisions/records/${rev.id}`);
      dlg.querySelector<HTMLElement>('[data-close]')!.click();
      onDone();
    } catch (x) {
      const de = dlg.querySelector<HTMLElement>('[data-del-error]')!;
      de.textContent = errText(x);
      de.hidden = false;
      b.disabled = false;
      b.textContent = 'Удалить карточку';
    }
  });
}
