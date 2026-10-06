// Общее для скриптов реестра (registry-watch, registry-diff): чтение
// Google-таблицы модератора без авторизации через gviz-CSV и карта
// «вкладка → категория». Сменился файл таблицы — правится SHEET_ID здесь.
export const SHEET_ID = '1J8U7oLfBSenFn7VKWL7gp1EfNfH8lFCV3THmpH8eiA8';
export const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

/** вкладка → папка категории в src/data/specialists */
export const CATEGORY_TABS = {
  'Организаторы': 'organizatory',
  'Координаторы': 'koordinatory',
  'Ведущие': 'vedushchie',
  'Декораторы': 'dekoratory',
  'Фотографы': 'fotografy',
  'Видеографы': 'videografy',
  'Reels-мейкеры': 'rils-meikery',
  'Кейтеринг': 'keitering',
  'Кондитеры': 'konditery',
  'Стилисты и визажисты': 'stilisty',
  'Диджеи': 'dj',
  'Кавер-группы': 'kaver-gruppy',
  'Вокалисты': 'vokalisty',
  'Музыканты': 'muzykanty',
  'Спецэффекты': 'speceffekty',
  'Аренда звука': 'arenda-zvuka',
  'Аренда светомузыки': 'arenda-sveta',
  'Хореографы': 'horeografy',
  'Аниматоры': 'animatory',
  'Шоу': 'shou',
  'Фокусники и иллюзионисты': 'fokusniki',
  'Авто и трансфер': 'avto',
};

export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch !== '\r') field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export async function fetchTab(title) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&headers=3&sheet=${encodeURIComponent(title)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${title}: HTTP ${res.status}`);
  const rows = parseCsv(await res.text());
  // Шапка таблицы — три строки (группы / ключи / подписи), и gviz без
  // подсказки сам решает, сколько из них считать заголовком. 06.10.2026
  // поймали, что на «Организаторах» он приклеил к шапке и ПЕРВУЮ СТРОКУ
  // ДАННЫХ («…Статус черновик», «…название АРТ Невеста») — первый подрядчик
  // вкладки молча выпадал из всех проверок. headers=3 фиксирует шапку:
  // приходит одна склеенная строка «Основное status Статус», ключ из неё —
  // первое латинское слово (в названиях групп латиницы нет). Поиск строки
  // ключей ниже оставлен на случай, если gviz снова поменяет поведение.
  const isKeyRow = (row) => {
    const filled = row.filter(Boolean);
    return filled.length > 3 && filled.every((c) => /^[A-Za-z][A-Za-z0-9_]*$/.test(c));
  };
  let keys, dataStart;
  const i = rows.slice(0, 3).findIndex(isKeyRow);
  if (i >= 0) { keys = rows[i]; dataStart = i + 2; }            // ниже строка подписей
  else { keys = (rows[0] ?? []).map((c) => (c.match(/\b[A-Za-z][A-Za-z0-9_]*\b/) ?? [''])[0]); dataStart = 1; }
  return rows.slice(dataStart)
    .map((cells) => Object.fromEntries(keys.map((k, i) => [k, (cells[i] ?? '').trim()])))
    .filter((r) => (r.name ?? '').trim());
}


export const norm = (s) => String(s ?? '').toLowerCase().replace(/ё/g, 'е').replace(/[«»"']/g, '').replace(/\s+/g, ' ').trim();
/** одно имя в таблице и на сайте пишут по-разному: «your food» / «Your Food»,
 *  «Кавер-группа WHY NOT» / «WHY NOT», «Матрешка» / «Матрёшка» */
export function sameName(a, b) {
  const x = norm(a), y = norm(b);
  return !!x && !!y && (x === y || x.includes(y) || y.includes(x));
}
