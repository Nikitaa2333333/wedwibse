// Двухцветный логотип (тёмное + светлое внутри бирки) → маска для CSS.
//   node scripts/logo-mask.mjs logooo.svg public/logo-tag.svg
//
// Логотип на сайте красится маской (mask: url(/logo-tag.svg) + background:
// var(--ink)) — так он сам меняет цвет в тёмной теме. Маска смотрит
// только на непрозрачность, поэтому светлый текст на бирке в ней
// залился бы тем же цветом и пропал. Здесь светлые части становятся
// ПРОРЕЗЯМИ: тёмные фигуры — белым в <mask>, светлые — чёрным. Сквозь
// прорезь виден фон страницы: на бумаге это тот же светлый текст, что
// в исходнике, в тёмной теме — тёмный текст на светлой бирке.
import { readFileSync, writeFileSync } from 'node:fs';

const [src, out] = process.argv.slice(2);
const svg = readFileSync(src, 'utf8');
const viewBox = svg.match(/viewBox="([^"]+)"/)[1];
const [, , w, h] = viewBox.split(/\s+/).map(Number);
const LIGHT = /fill="#(F7F5F2|FFF|FFFFFF)"/i;

const parts = [...svg.matchAll(/<path\b[^>]*\/>/g)].map(([p]) => {
  if (LIGHT.test(p)) return p.replace(/fill="[^"]*"/, 'fill="#000"');
  return p.replace(/fill="#[0-9a-f]{3,6}"/gi, 'fill="#fff"').replace(/stroke="#[0-9a-f]{3,6}"/gi, 'stroke="#fff"');
});

writeFileSync(out, `<svg width="${w}" height="${h}" viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">
<!-- Маска логотипа, собрана scripts/logo-mask.mjs из цветного исходника. Цвет задаёт CSS. -->
<defs><mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}">
${parts.join('\n')}
</mask></defs>
<rect width="${w}" height="${h}" fill="#fff" mask="url(#m)"/>
</svg>
`);
console.log(`${out}: ${parts.length} фигур, ${w}×${h}`);
