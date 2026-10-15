/**
 * Заметки сверки прямо в Google-таблице реестра (06.10.2026).
 *
 * Каждое утро GitHub Actions (registry-nightly.yml) сверяет таблицу с сайтом
 * и кладёт отчёт на https://wed-secrets.ru/registry/report.json. Этот скрипт
 * забирает отчёт и вешает ЗАМЕТКИ на ячейку с именем подрядчика / площадки:
 * треугольник в углу, текст — при наведении. Старые заметки сверки снимает
 * сам; заметки, которые писали люди, не трогает (свои узнаёт по заголовку).
 *
 * Установка — один раз:
 *   1. Таблица → Расширения → Apps Script → новый файл, вставить этот код.
 *   2. Выбрать функцию installTrigger → «Выполнить» → разрешить доступ.
 *   3. Готово: каждый день в 8:00 (после сверки в 7:00) заметки обновляются.
 *      Обновить сразу — запустить syncRegistryNotes.
 *
 * Ничего не отправляет наружу: только читает отчёт с нашего сайта
 * и пишет заметки в эту же таблицу от имени её владельца.
 */

const REPORT_URL = 'https://wed-secrets.ru/registry/report.json';
const MARK = 'Сверка с сайтом';
const FIRST_ROW = 4;   // строки 1–3 — шапка (группы / ключи / подписи)
const NAME_COL = 2;    // B — «Имя / название»

function norm_(s) {
  return String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[«»"']/g, '').replace(/\s+/g, ' ').trim();
}
/** «your food» / «Your Food», «Кавер-группа WHY NOT» / «WHY NOT» — то же сопоставление, что в registry-lib.mjs */
function sameName_(a, b) {
  const x = norm_(a), y = norm_(b);
  return !!x && !!y && (x === y || x.indexOf(y) >= 0 || y.indexOf(x) >= 0);
}

function syncRegistryNotes() {
  const res = UrlFetchApp.fetch(REPORT_URL, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('Отчёт сверки недоступен: HTTP ' + res.getResponseCode());
  const report = JSON.parse(res.getContentText());

  // вкладка → [{ name, lines }]
  const byTab = {};
  const take = function (kind, prefix) {
    (report[kind] || []).forEach(function (item) {
      const m = String(item.who).match(/^(.*) \((.+)\)$/);
      if (!m) return;
      const tab = m[2], name = m[1];
      if (!byTab[tab]) byTab[tab] = [];
      let entry = byTab[tab].filter(function (e) { return sameName_(e.name, name); })[0];
      if (!entry) { entry = { name: name, lines: [] }; byTab[tab].push(entry); }
      entry.lines.push(prefix + item.what);
    });
  };
  take('changed', '≠ ');
  take('links', '⚠ ');
  take('unmatched', '＋ ');

  const stamp = Utilities.formatDate(new Date(), 'Europe/Moscow', 'dd.MM.yyyy');
  let placed = 0;

  SpreadsheetApp.getActive().getSheets().forEach(function (sheet) {
    const last = sheet.getLastRow();
    if (last < FIRST_ROW) return;
    const range = sheet.getRange(FIRST_ROW, NAME_COL, last - FIRST_ROW + 1, 1);
    const names = range.getValues();
    const notes = range.getNotes();
    let dirty = false;
    const items = byTab[sheet.getName()] || [];
    for (let i = 0; i < names.length; i++) {
      // своя вчерашняя заметка — снимаем; чужую (человеческую) не трогаем
      if (String(notes[i][0]).indexOf(MARK) === 0) { notes[i][0] = ''; dirty = true; }
      const name = names[i][0];
      if (!name) continue;
      const hit = items.filter(function (e) { return sameName_(e.name, name); })[0];
      if (hit && !notes[i][0]) {
        notes[i][0] = MARK + ' · ' + stamp + '\n' + hit.lines.join('\n');
        dirty = true;
        placed++;
      }
    }
    if (dirty) range.setNotes(notes);
  });
  Logger.log('Заметок сверки: ' + placed);
}

/** Один раз: ежедневный запуск в 8:00 (часовой пояс таблицы). */
function installTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === 'syncRegistryNotes'; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('syncRegistryNotes').timeBased().everyDays(1).atHour(8).create();
  syncRegistryNotes();
}
