// Генератор реестра иконок: вытаскивает нужные контуры из данных Iconify
// в статический src/lib/icons.ts. Запуск: node scripts/gen-icons.mjs
//
// Зачем генерация, а не чтение JSON на сборке: пакеты @iconify-json весят
// мегабайты и лежат в devDependencies — прод-сборка от них не зависит,
// в репозитории живёт только десяток нужных контуров.
//
// Набор — Solar. Навигация (нижний док) — стиль Linear, контурный;
// служебные иконки (закрыть, каретки, аккаунт) — Bold. Меняем иконку
// или стиль — правим таблицу ниже и перегоняем скрипт.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));

const SET = 'solar';

// ключ в проекте -> имя иконки в наборе
const MAP = {
  // нижний док — контурные
  home: 'home-2-linear',
  venue: 'map-point-linear',
  vendors: 'users-group-rounded-linear',
  heart: 'heart-linear',
  // контурное сердце: состояние «не в избранном» у кнопки на фото
  heartOutline: 'heart-linear',
  account: 'user-bold',
  caretDown: 'alt-arrow-down-bold',
  arrowLeft: 'alt-arrow-left-bold',
  // стрелки листания кадров под окном первого экрана
  arrowRight: 'alt-arrow-right-bold',
  close: 'close-bold',
  // ролик в ряду «Видео»: запуск и пауза по кнопке, без автозапуска
  play: 'play-bold',
  pause: 'pause-bold',
  // строка фактов первого экрана: оценка и число отзывов
  star: 'star-bold',
  // Заливная, не контурная: рядом со звездой (star-bold) контур читался
  // другим набором — знаки одной строки фактов должны быть одного веса.
  chat: 'chat-round-bold',
  // звук ролика: кнопка на кадре переключает эти два состояния
  sound: 'volume-loud-bold',
  soundOff: 'muted-bold',
  // переключатель выдачи «сетка ↔ карта» в шапке каталога площадок.
  // Контурные, как знак локации (venue) в соседнем чипе: в одном ряду
  // заливная иконка читалась бы другим набором.
  map: 'map-linear',
  list: 'list-linear',
  // панель поверх кадра карточки: поделиться и отметка «ссылка скопирована».
  // Стрелка-пересылка, а не скрепка: скрепка читается как «приложить файл»,
  // а привычный по мессенджерам знак «поделиться» — именно загнутая стрелка.
  share: 'forward-bold',
  check: 'check-read-bold',
};

const data = require(`@iconify-json/${SET}/icons.json`);

const entries = Object.entries(MAP).map(([key, name]) => {
  const item = data.icons[name];
  if (!item) throw new Error(`Нет иконки ${SET}:${name}`);
  const w = item.width ?? data.width ?? 24;
  const h = item.height ?? data.height ?? 24;
  const l = item.left ?? 0;
  const t = item.top ?? 0;
  // Контурные иконки (сердце, док) несут на path свой fill="none". Через
  // <use> из спрайта внутрь символа не достаёт ни `svg > * { fill }`, ни
  // fill на внешнем svg — презентационный атрибут в теневом дереве побеждает.
  // Единственное, что наследуется внутрь <use>, — кастомные свойства, поэтому
  // заливку выводим на ручку: состояние «сохранено» ставит
  // `svg { --icon-fill: currentColor }` (global.css .save/.hero-btn,
  // izbrannoe .pick__btn--yes, index.astro .hint__heart).
  const body = item.body.replace(/fill="none"/g, 'style="fill:var(--icon-fill,none)"');
  return { key, name, body, viewBox: `${l} ${t} ${w} ${h}` };
});

// Внешний спрайт (public/icons.svg): каждая иконка — свой <symbol>,
// Icon.astro подключает её через <use href="/icons.svg?v=<hash>#i-key">
// вместо инлайна полного контура на каждое место использования (см. AUDIT.md —
// на карточке площадки с несколькими роликами повторяющиеся sound/soundOff/play
// раздували HTML на десятки КБ).
// icons.ts со старым набором {viewBox, body} остаётся: src/pages/izbrannoe/index.astro
// строит SVG-строки на клиенте из localStorage и берёт контуры оттуда напрямую.
const spriteSvg = `<svg xmlns="http://www.w3.org/2000/svg">
${entries.map((e) => `  <symbol id="i-${e.key}" viewBox="${e.viewBox}">${e.body}</symbol>`).join('\n')}
</svg>
`;

// Хеш содержимого спрайта — версия в query (?v=), чтобы браузер и CDN
// сбрасывали кеш файла при перегенерации иконок, без ручной правки версии.
const spriteVersion = createHash('sha1').update(spriteSvg).digest('hex').slice(0, 8);

const out = `// СГЕНЕРИРОВАНО scripts/gen-icons.mjs — руками не править.
// Набор Solar (Bold), лицензия CC BY 4.0 — https://github.com/480-Design/Solar-Icon-Set
// Добавить иконку: дописать её в MAP генератора и прогнать \`node scripts/gen-icons.mjs\`.

// Версия спрайта public/icons.svg (см. ниже) — используется в Icon.astro
// и Layout.astro как ?v=<spriteVersion>, чтобы обновление иконок не залипало
// в кеше браузера/CDN на старом файле.
export const spriteVersion = '${spriteVersion}';

export const icons = {
${entries.map((e) => `  /** ${SET}:${e.name} */\n  ${e.key}: {\n    viewBox: '${e.viewBox}',\n    body: ${JSON.stringify(e.body)},\n  },`).join('\n')}
} as const;

export type IconName = keyof typeof icons;
`;

writeFileSync(resolve(here, '../src/lib/icons.ts'), out, 'utf8');
writeFileSync(resolve(here, '../public/icons.svg'), spriteSvg, 'utf8');
console.log(`icons.ts + public/icons.svg: ${entries.length} иконок из набора ${SET}, версия ${spriteVersion}`);
