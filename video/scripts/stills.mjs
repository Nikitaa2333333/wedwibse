// Контрольные кадры для самопроверки: node scripts/stills.mjs PromoVertical 100 300 … → out/stills/
// Сборка один раз, кадры — по списку (быстрее, чем `remotion still` на каждый).
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import { mkdirSync } from 'node:fs';
const [id = 'PromoVertical', ...frames] = process.argv.slice(2);
const serveUrl = await bundle({ entryPoint: new URL('../src/index.ts', import.meta.url).pathname, publicDir: new URL('../public', import.meta.url).pathname });
const browserExecutable = process.env.REMOTION_CHROME || null;
const composition = await selectComposition({ serveUrl, id, browserExecutable });
mkdirSync('out/stills', { recursive: true });
for (const fr of frames.map(Number)) {
  await renderStill({ serveUrl, composition, frame: fr, output: `out/stills/${id}-${String(fr).padStart(4, '0')}.png`, scale: 0.4, browserExecutable });
  console.log('ok', fr);
}
