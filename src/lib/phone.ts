/* ============================================================
   Телефон с выбором кода страны — Россия + СНГ. Перенесён с сайта клиники
   КТМ (ktm-site/src/lib/phone.ts) для контактов в кабинете подрядчика
   (Никита, 27.10.2026); там решение клиники от 01.09.2026. Модуль общий: серверная часть (Astro-фронтматтер)
   рендерит <option> из PHONE_COUNTRIES, клиентский скрипт форм
   («Задать вопрос», «Онлайн-встреча») тем же модулем форматирует
   ввод и проверяет номер перед отправкой. Один источник — список
   стран и длины номеров не расходятся между вёрсткой и валидацией.

   Казахстан и Россия делят код +7 — по цифрам их не различить,
   разница только в выборе флага человеком; для длины номера это
   не важно, у обеих стран 10 цифр после кода.
   ============================================================ */

export interface PhoneCountry {
  code: string; // ISO-2 — значение <option>, и же имя файла флага
  dial: string; // код страны без «+»
  name: string; // название в выпадающем списке
  len: number; // сколько цифр после кода страны у номера
  groups: number[]; // разбивка этих цифр на группы для отображения
}

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { code: 'RU', dial: '7', name: 'Россия', len: 10, groups: [3, 3, 2, 2] },
  { code: 'AZ', dial: '994', name: 'Азербайджан', len: 9, groups: [2, 3, 2, 2] },
  { code: 'AM', dial: '374', name: 'Армения', len: 8, groups: [2, 3, 3] },
  { code: 'BY', dial: '375', name: 'Беларусь', len: 9, groups: [2, 3, 2, 2] },
  { code: 'KZ', dial: '7', name: 'Казахстан', len: 10, groups: [3, 3, 2, 2] },
  { code: 'KG', dial: '996', name: 'Кыргызстан', len: 9, groups: [3, 3, 3] },
  { code: 'TJ', dial: '992', name: 'Таджикистан', len: 9, groups: [2, 3, 2, 2] },
  { code: 'UZ', dial: '998', name: 'Узбекистан', len: 9, groups: [2, 3, 2, 2] },
];

export const DEFAULT_PHONE_COUNTRY = 'RU';

export function findCountry(code: string): PhoneCountry {
  return PHONE_COUNTRIES.find((c) => c.code === code) ?? PHONE_COUNTRIES[0];
}

/* Настоящий флаг картинкой, не эмодзи: эмодзи-флаги на части экранов/шрифтов
   рисуются как две буквы кода вместо флага. Файлы — flag-icons (MIT),
   public/flags/. */
export function flagSrc(country: PhoneCountry): string {
  return `/flags/${country.code.toLowerCase()}.svg`;
}

/** Цифры национального номера: без кода страны, без лишних символов.
    «8» в начале — местная приставка только у России/Казахстана (общий код +7). */
export function nationalDigits(value: string, country: PhoneCountry): string {
  let d = value.replace(/\D+/g, '');
  if (d.startsWith(country.dial) && d.length > country.len) d = d.slice(country.dial.length);
  if ((country.code === 'RU' || country.code === 'KZ') && d.startsWith('8')) d = d.slice(1);
  // Российский номер с 7 не начинается — это набранный код страны. Срезаем
  // сразу, а не на 11-й цифре: иначе номер стоял со сдвигом и в конце
  // перескакивал. У Казахстана 7 — начало номера (+7 701…), его не трогаем.
  if (country.code === 'RU' && d.startsWith('7')) d = d.slice(1);
  return d.slice(0, country.len);
}

export function formatNational(digits: string, country: PhoneCountry): string {
  let out = '';
  let i = 0;
  country.groups.forEach((len, gi) => {
    const part = digits.slice(i, i + len);
    if (!part) return;
    if (gi === 0) out += '(' + part + (part.length === len ? ')' : '');
    else out += (gi === 1 ? ' ' : '-') + part;
    i += len;
  });
  return out;
}

export function placeholderFor(country: PhoneCountry): string {
  return formatNational('_'.repeat(country.len), country).replace(/\d|_/g, '_');
}

export function isComplete(digits: string, country: PhoneCountry): boolean {
  return digits.length === country.len;
}

export function fullE164(digits: string, country: PhoneCountry): string {
  return '+' + country.dial + digits;
}

export function phoneErrorMessage(country: PhoneCountry): string {
  return `Укажите, пожалуйста, номер полностью: +${country.dial} и ${country.len} цифр.`;
}

/** Собирает страну + номер из уже отправленной формы (FormData) — то, что
    реально ушло в поля name="phoneCountry" / name="phone". */
export function phoneFromFormData(fd: FormData) {
  const country = findCountry(String(fd.get('phoneCountry') || DEFAULT_PHONE_COUNTRY));
  const digits = nationalDigits(String(fd.get('phone') || ''), country);
  return { country, digits, valid: isComplete(digits, country), e164: fullE164(digits, country) };
}

/** Свой выпадающий список кода страны — не нативный <select>: на телефоне
    он открывает системный пикер (тяжёлый чужой лист поверх страницы, ощутимая
    задержка), а тут нужен наш собственный вид. Разметка внутри .cc-picker:
      .cc-toggle          — видимая кнопка (флаг + код + шеврон)
      .cc-list            — выпадающая панель, role="menu", изначально hidden
        .cc-option[data-code] — role="menuitemradio" на каждую страну
      input[name="phoneCountry"] — скрытое поле, реальное значение формы
    Открытие/закрытие, клик вне и Esc, стрелки между пунктами — здесь же. */
/* Сколько цифр стоит до курсора в исходной (ещё не переформатированной)
   строке — и где после переформатирования курсор должен встать, чтобы
   остаться «за той же цифрой». Без этого input.value = … на каждое
   нажатие уводил курсор в конец поля, и backspace в середине номера
   стирал не ту цифру (жалоба клиники 02.09.2026). */
function digitsBeforePosition(value: string, pos: number): number {
  return value.slice(0, pos).replace(/\D+/g, '').length;
}

function positionAfterDigits(formatted: string, n: number): number {
  if (n <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i])) {
      seen++;
      if (seen === n) return i + 1;
    }
  }
  return formatted.length;
}

export function attachPhoneField(picker: HTMLElement, input: HTMLInputElement) {
  const toggle = picker.querySelector<HTMLButtonElement>('.cc-toggle');
  const list = picker.querySelector<HTMLElement>('.cc-list');
  const hidden = picker.querySelector<HTMLInputElement>('input[name="phoneCountry"]');
  const flagImg = picker.querySelector<HTMLImageElement>('.cc-flag');
  const codeEl = picker.querySelector<HTMLElement>('.cc-code');
  const options = Array.from(picker.querySelectorAll<HTMLButtonElement>('.cc-option'));
  if (!toggle || !list || !hidden || !flagImg || !codeEl || !options.length) return;

  const country = () => findCountry(hidden.value);

  const format = (c: PhoneCountry) => {
    const digits = nationalDigits(input.value, c);
    // Набрали только «8»/«7» (код страны) — показываем скобку, чтобы было
    // видно, что нажатие принято: пустое поле читалось как «телефон завис».
    if (!digits && /\d/.test(input.value)) return '(';
    return formatNational(digits, c);
  };

  const syncPhone = (preserveCaret = false) => {
    const c = country();
    if (!preserveCaret) {
      // Подсказка меняется только со страной — не на каждое нажатие.
      input.placeholder = placeholderFor(c);
      input.value = format(c);
      return;
    }
    // Поле и курсор переписываем, только если текст правда изменился:
    // лишняя запись на каждую цифру на Android заставляет клавиатуру
    // заново подхватывать поле (подтормаживание при наборе).
    const next = format(c);
    if (next === input.value) return;
    // Курсор считаем в цифрах, а не в символах: пробелы/скобки/тире
    // переформатирование само расставляет заново.
    const digitsBefore = digitsBeforePosition(input.value, input.selectionStart ?? input.value.length);
    input.value = next;
    const caret = next === '(' ? 1 : positionAfterDigits(next, digitsBefore);
    input.setSelectionRange(caret, caret);
  };

  const syncChip = () => {
    const c = country();
    flagImg.src = flagSrc(c);
    flagImg.alt = c.name;
    codeEl.textContent = '+' + c.dial;
    toggle.setAttribute('aria-label', `Код страны: ${c.name} +${c.dial}`);
    options.forEach((opt) => opt.setAttribute('aria-checked', String(opt.dataset.code === c.code)));
  };

  const close = () => {
    list.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    picker.classList.remove('open');
  };
  const open = () => {
    list.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    picker.classList.add('open');
    (options.find((o) => o.dataset.code === hidden.value) ?? options[0]).focus();
  };

  toggle.addEventListener('click', () => (list.hidden ? open() : close()));

  list.addEventListener('click', (e) => {
    const opt = (e.target as HTMLElement)?.closest<HTMLButtonElement>('.cc-option');
    if (!opt?.dataset.code) return;
    hidden.value = opt.dataset.code;
    syncChip();
    syncPhone();
    close();
    toggle.focus();
  });

  list.addEventListener('keydown', (e) => {
    const i = options.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); options[Math.min(i + 1, options.length - 1)]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); options[Math.max(i - 1, 0)]?.focus(); }
    else if (e.key === 'Escape') { close(); toggle.focus(); }
    else if (e.key === 'Tab') { close(); }
  });

  document.addEventListener('click', (e) => {
    if (!list.hidden && !picker.contains(e.target as Node)) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !list.hidden) { close(); toggle.focus(); }
  });

  input.addEventListener('input', () => syncPhone(true));
  syncPhone();
  syncChip();
}
