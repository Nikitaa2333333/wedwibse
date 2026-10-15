// node scripts/shot.mjs <путь> <селектор|y> <out.png> [высота] — самопроверка вёрстки
// снимком в ширине телефона 390px (DPR 1.5) с дев-сервера 127.0.0.1:4327.
// Git Bash: перед запуском export MSYS_NO_PATHCONV=1 (иначе путь «/moskva/…»
// превращается в путь Windows). Браузер — Chromium из кэша Playwright.
import { chromium } from 'playwright-core';
import { homedir } from 'node:os';
const [, , path, where = '0', out = 'shot.png', h = '844'] = process.argv;
const browser = await chromium.launch({ executablePath: `${homedir()}/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe` });
const page = await browser.newPage({ viewport: { width: 390, height: Number(h) }, deviceScaleFactor: 1.5 });
await page.goto(`http://127.0.0.1:4327${path}`, { waitUntil: 'networkidle' });
if (/^\d+$/.test(where)) await page.evaluate((y) => window.scrollTo(0, y), Number(where));
else await page.evaluate((sel) => { const el = document.querySelector(sel); if (el) { el.scrollIntoView(); window.scrollBy(0, -90); } }, where);
await page.waitForTimeout(700);
await page.screenshot({ path: out });
await browser.close();
console.log('ok', out);
