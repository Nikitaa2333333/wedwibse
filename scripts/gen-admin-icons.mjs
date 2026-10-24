// Генератор значков админки: вытаскивает контуры Solar (стиль Bold Duotone —
// двухтоновый, тон второго слоя — полупрозрачный currentColor) из данных
// Iconify в статический src/lib/admin-icons.ts. Запуск:
//   node scripts/gen-admin-icons.mjs
// Как и gen-icons.mjs: пакет @iconify-json/solar — devDependency, сборка
// сайта от него не зависит, в репозитории — только нужные контуры.
// Новый значок — строка в таблицу ниже и перегнать скрипт.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const data = require('@iconify-json/solar/icons.json');

// ключ в админке -> имя в наборе Solar
const MAP = {
  // меню
  overview: 'widget-2-bold-duotone',
  partners: 'user-plus-rounded-bold-duotone',
  moderation: 'shield-check-bold-duotone',
  catalog: 'folder-with-files-bold-duotone',
  complaints: 'danger-triangle-bold-duotone',
  // показатели и разделы экранов
  cards: 'layers-bold-duotone',
  noContacts: 'phone-bold-duotone',
  photo: 'gallery-bold-duotone',
  clock: 'clock-circle-bold-duotone',
  text: 'document-text-bold-duotone',
  notes: 'chat-round-dots-bold-duotone',
  history: 'history-bold-duotone',
  disk: 'cloud-download-bold-duotone',
  check: 'check-circle-bold-duotone',
  bell: 'bell-bold-duotone',
  // связь
  phone: 'phone-bold-duotone',
  telegram: 'plain-bold-duotone',
  mail: 'letter-bold-duotone',
  copy: 'copy-bold-duotone',
  link: 'link-round-bold-duotone',
  // служебные стрелки и поиск — тонкие
  search: 'magnifer-bold-duotone',
  down: 'alt-arrow-down-linear',
  back: 'alt-arrow-left-linear',
  next: 'alt-arrow-right-linear',
  external: 'arrow-right-up-linear',
  plus: 'add-circle-bold-duotone',
};

const entries = Object.entries(MAP).map(([key, name]) => {
  const item = data.icons[name];
  if (!item) throw new Error(`нет иконки ${name} в наборе solar`);
  return { key, name, body: item.body };
});

const out = `// СГЕНЕРИРОВАНО scripts/gen-admin-icons.mjs — руками не править.
// Значки админки: Solar Bold Duotone (меню, разделы) и Linear (стрелки).
export const ADMIN_ICONS = {
${entries.map((e) => `  /** solar:${e.name} */\n  ${e.key}: ${JSON.stringify(e.body)},`).join('\n')}
} as const;

export type AdminIconName = keyof typeof ADMIN_ICONS;
`;

writeFileSync(resolve(here, '../src/lib/admin-icons.ts'), out, 'utf8');
console.log(`admin-icons.ts: ${entries.length} значков`);
