// Хук Stop: не даёт закончить сессию, пока карта проекта не обновлена.
//
// Владелец (Никита, 05.11.2026): «самое главное — карта проекта, туда должно
// лететь всё». Правило было записано только в скилле control-map и в шапке
// ROADMAP — их не читали, и сессия заканчивалась без записи в карту.
//
// Логика: читаем журнал сессии (transcript_path из входа хука). Если в нём
// есть правки файлов проекта (Edit/Write/NotebookEdit — не память и не
// scratchpad) или git commit, а `scripts/map.mjs` не вызывался ни разу —
// блокируем остановку с причиной. Повторно не блокируем (stop_hook_active),
// чтобы не зациклиться, если запись в карту невозможна.
import { readFileSync } from 'node:fs';

let input = {};
try {
  input = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {}

if (input.stop_hook_active || !input.transcript_path) process.exit(0);

let lines = [];
try {
  lines = readFileSync(input.transcript_path, 'utf8').split('\n');
} catch {
  process.exit(0);
}

// не проект: память, scratchpad, временные файлы, сама карта не в счёт
const SKIP = /[\\/]\.claude[\\/]projects[\\/]|[\\/]Temp[\\/]|scratchpad|[\\/]tmp[\\/]/i;

let worked = false;
let mapped = false;

for (const line of lines) {
  if (!line.includes('tool_use')) continue;
  let rec;
  try {
    rec = JSON.parse(line);
  } catch {
    continue;
  }
  const content = rec?.message?.content;
  if (!Array.isArray(content)) continue;
  for (const c of content) {
    if (c?.type !== 'tool_use') continue;
    const inp = c.input || {};
    if (['Edit', 'Write', 'NotebookEdit'].includes(c.name)) {
      const p = String(inp.file_path || inp.notebook_path || '');
      if (p && !SKIP.test(p)) worked = true;
    }
    if (c.name === 'Bash' || c.name === 'PowerShell') {
      const cmd = String(inp.command || '');
      if (/map\.mjs/.test(cmd)) mapped = true;
      if (/git\s+(-C\s+\S+\s+)?commit\b/.test(cmd) && !/map\.mjs/.test(cmd)) worked = true;
    }
  }
}

if (worked && !mapped) {
  process.stdout.write(
    JSON.stringify({
      decision: 'block',
      reason:
        'Карта проекта не обновлена: в этой сессии менялись файлы, а scripts/map.mjs не вызывался. ' +
        'Обнови карту по скиллу control-map: шаги (step / add-step), проблемы (add-issue), решения владельца (decision) ' +
        'и итог сессии (map.mjs session итог.json), затем map.mjs check и коммит вместе с работой. ' +
        'Если работа в ветке, которая не скоро попадёт в master, — запись в карту отдельным коммитом от свежего master.',
    })
  );
}
process.exit(0);
