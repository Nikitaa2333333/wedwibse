// Шрифты сайта (video/public/fonts → public/fonts сайта, scripts/link-assets.sh).
// Через FontFace + delayRender: кадр не снимается, пока шрифт не загружен.
import { continueRender, delayRender, staticFile } from 'remotion';

const CYR = 'U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116';
const LAT = 'U+0000-00FF, U+20BD, U+2013-2014, U+2018-201E, U+2026';
const FACES: [string, string, string, string][] = [
  ['Onest', 'onest-cyrillic.woff2', '100 900', CYR],
  ['Onest', 'onest-latin.woff2', '100 900', LAT],
  ['Cormorant', 'cormorant-cyrillic.woff2', '300 700', CYR],
  ['Cormorant', 'cormorant-latin.woff2', '300 700', LAT],
];

const handle = delayRender('шрифты');
Promise.all(
  FACES.map(([family, file, weight, unicodeRange]) =>
    new FontFace(family, `url(${staticFile(`fonts/${file}`)}) format('woff2')`, { weight, unicodeRange })
      .load()
      .then((f) => document.fonts.add(f)),
  ),
).then(() => continueRender(handle));
