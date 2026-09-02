// ВРЕМЕННО (удалить вместе со страницей /icons после выбора набора).
// Достаёт готовый SVG-контур из данных Iconify. Пакеты @iconify-json/*
// стоят в devDependencies: JSON читается на сборке, в клиент не уезжает
// ни байта — в HTML попадает только тело выбранной иконки.
import ph from '@iconify-json/ph/icons.json';
import solar from '@iconify-json/solar/icons.json';
import iconoir from '@iconify-json/iconoir/icons.json';
import hugeicons from '@iconify-json/hugeicons/icons.json';

type IconifySet = {
  icons: Record<string, { body: string; width?: number; height?: number; left?: number; top?: number }>;
  width?: number;
  height?: number;
};

const sets: Record<string, IconifySet> = {
  ph: ph as IconifySet,
  solar: solar as IconifySet,
  iconoir: iconoir as IconifySet,
  hugeicons: hugeicons as IconifySet,
};

export function iconSvg(prefix: string, name: string) {
  const set = sets[prefix];
  const item = set?.icons?.[name];
  if (!item) return null;
  const w = item.width ?? set.width ?? 24;
  const h = item.height ?? set.height ?? 24;
  const l = item.left ?? 0;
  const t = item.top ?? 0;
  return { body: item.body, viewBox: `${l} ${t} ${w} ${h}` };
}
