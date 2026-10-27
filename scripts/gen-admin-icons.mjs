// Генератор значков админки: вытаскивает контуры Solar (стиль Linear — тонкая
// линия, «стандартные» значки, Никита 27.10; раньше был Bold Duotone) из данных
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
  overview: 'widget-2-linear',
  partners: 'user-plus-rounded-linear',
  moderation: 'shield-check-linear',
  catalog: 'folder-with-files-linear',
  complaints: 'danger-triangle-linear',
  // показатели и разделы экранов
  cards: 'layers-linear',
  noContacts: 'phone-linear',
  photo: 'gallery-linear',
  clock: 'clock-circle-linear',
  text: 'document-text-linear',
  notes: 'chat-round-dots-linear',
  history: 'history-linear',
  disk: 'cloud-download-linear',
  check: 'check-circle-linear',
  bell: 'bell-linear',
  // связь
  phone: 'phone-linear',
  telegram: 'plain-linear',
  mail: 'letter-linear',
  copy: 'copy-linear',
  link: 'link-round-linear',
  // служебные стрелки и поиск — тонкие
  search: 'magnifier-linear',
  down: 'alt-arrow-down-linear',
  back: 'alt-arrow-left-linear',
  next: 'alt-arrow-right-linear',
  external: 'arrow-right-up-linear',
  plus: 'add-circle-linear',
};

const entries = Object.entries(MAP).map(([key, name]) => {
  const item = data.icons[name];
  if (!item) throw new Error(`нет иконки ${name} в наборе solar`);
  return { key, name, body: item.body };
});

const out = `// СГЕНЕРИРОВАНО scripts/gen-admin-icons.mjs — руками не править.
// Значки админки: Solar Linear (тонкая линия).
export const ADMIN_ICONS = {
${entries.map((e) => `  /** solar:${e.name} */\n  ${e.key}: ${JSON.stringify(e.body)},`).join('\n')}
} as const;

export type AdminIconName = keyof typeof ADMIN_ICONS;
`;

writeFileSync(resolve(here, '../src/lib/admin-icons.ts'), out, 'utf8');
console.log(`admin-icons.ts: ${entries.length} значков`);
