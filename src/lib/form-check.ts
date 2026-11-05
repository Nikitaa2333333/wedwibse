// ПРОВЕРКА ФОРМ БЕЗ ОКОН БРАУЗЕРА И БЕЗ ПРЫЖКОВ ВЁРСТКИ (05.11.2026).
// Было: у полей `required` без `novalidate` — браузер рисовал своё окошко
// «Заполните это поле» поверх дизайна. Потом строка ошибки под полем —
// но она раздвигала форму, и всё ниже прыгало (Никита: «не нравится, когда
// растягивается экран»). Теперь — как у Apple: рамка поля цветом ошибки
// и облачко .tip над полем с хвостиком к нему («Введите почту»). Облачко
// лежит поверх вёрстки — ничего не сдвигается. Общая ошибка формы (нет
// связи, лимит попыток) — таким же облачком над кнопкой отправки.
//
//   checkForm(form)          — один раз на форму: проверка при отправке,
//                              обработчик экрана сработает, только если всё верно;
//   fieldError(input, text)  — ответ сервера про конкретное поле
//                              («Неверная почта или пароль» → на поле пароля).
// Пустую только что открытую форму не ругаем; начал исправлять — подпись уходит.

const NAME: Record<string, string> = { email: 'почту', password: 'пароль', code: 'код из письма', name: 'имя', phone: 'телефон' };

function message(el: HTMLInputElement): string {
  const v = el.validity;
  const what = NAME[el.name] ?? (el.getAttribute('aria-label') || 'значение').toLowerCase();
  if (v.valueMissing) return el.type === 'checkbox' ? 'Отметьте, чтобы продолжить' : `Введите ${what}`;
  if (v.typeMismatch && el.type === 'email') return 'В адресе ошибка, пример: name@mail.ru';
  if (v.tooShort) return `${el.name === 'password' ? 'Пароль' : 'Нужно'} не короче ${el.minLength} знаков`;
  if (v.tooLong) return `Не длиннее ${el.maxLength} знаков`;
  if (v.patternMismatch) return el.title || 'Проверьте, что введено';
  return 'Проверьте, что введено';
}

/** обёртка поля — точка отсчёта для подписи внутри; ставится один раз, вёрстку не меняет */
function box(el: HTMLInputElement): HTMLElement {
  const p = el.parentElement!;
  if (p.classList.contains('fieldbox')) return p;
  const b = document.createElement('span');
  b.className = 'fieldbox';
  el.replaceWith(b);
  b.append(el);
  return b;
}

// облачко поля: у поля может быть своя «опора» (строка телефона с флагом —
// облачко к строке целиком, не к одному input)
const tips = new WeakMap<HTMLElement, HTMLElement>();

export function clearFieldError(el: HTMLInputElement) {
  el.removeAttribute('aria-invalid');
  tips.get(el)?.remove();
  tips.delete(el);
}

/** облачко с ошибкой над полем (или над anchor); ничего не сдвигает */
export function fieldError(el: HTMLInputElement, text: string, anchor?: HTMLElement) {
  clearFieldError(el);
  const b = anchor ?? box(el);
  if (anchor && getComputedStyle(anchor).position === 'static') anchor.style.position = 'relative';
  el.setAttribute('aria-invalid', 'true');
  const m = document.createElement('span');
  m.className = 'tip tip--bad';
  m.setAttribute('role', 'alert');
  m.textContent = text;
  b.append(m);
  tips.set(el, m);
}

/** облачко над кнопкой отправки — общая ошибка формы; пустой текст — убрать */
export function formError(form: HTMLFormElement, text: string) {
  const btn = form.querySelector<HTMLElement>('button[type=submit], button:not([type])');
  if (!btn) return;
  let b = btn.parentElement!;
  if (!b.classList.contains('fieldbox')) {
    b = document.createElement('span');
    b.className = 'fieldbox';
    btn.replaceWith(b);
    b.append(btn);
  }
  b.querySelector(':scope > .tip')?.remove();
  if (!text) return;
  const m = document.createElement('span');
  m.className = 'tip tip--bad tip--center';
  m.setAttribute('role', 'alert');
  m.textContent = text;
  b.append(m);
}

export function checkForm(form: HTMLFormElement) {
  form.noValidate = true;
  // строки общей ошибки экрана ([role=alert] в форме) показываем облачком над
  // кнопкой: экран по-прежнему пишет в свою строку, сама строка не видна
  form.querySelectorAll<HTMLElement>('[role=alert]:not(.tip)').forEach((line) => {
    line.classList.add('form-line-hidden');
    const sync = () => formError(form, line.hidden ? '' : (line.textContent ?? '').trim());
    new MutationObserver(sync).observe(line, { attributes: true, attributeFilter: ['hidden'], childList: true, characterData: true, subtree: true });
  });
  form.addEventListener('input', () => formError(form, ''));
  const fields = () => [...form.querySelectorAll<HTMLInputElement>('input:not([type=hidden]):not([type=checkbox]), textarea')];
  fields().forEach(box);

  form.addEventListener('input', (e) => {
    const el = e.target as HTMLInputElement;
    if (el.getAttribute('aria-invalid')) clearFieldError(el);
  });

  // capture: срабатывает раньше обработчика отправки на экране и гасит его
  form.addEventListener('submit', (e) => {
    let first: HTMLInputElement | null = null;
    for (const el of fields()) {
      clearFieldError(el);
      if (el.checkValidity()) continue;
      fieldError(el, message(el));
      first ??= el;
    }
    if (first) {
      e.preventDefault();
      e.stopImmediatePropagation();
      first.focus();
    }
  }, true);
}
