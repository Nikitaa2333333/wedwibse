// Снимки настоящего сайта для ролика: лента, карточка площадки, шторка заявки.
// Нужен дев-сервер сайта: из корня `npx astro dev --host 127.0.0.1 --port 4327`.
// Запуск из video/: `node scripts/capture.mjs` → public/ui/*.png (в git не идут).
// Ширина телефона 390 CSS px, DPR 3 — чтобы кадр держал крупный наезд в ролике.
// Служебное (нижнее меню, переключатель темы, кнопка входа) прячем: в ролике
// показываем интерфейс, а не обвязку.
import { chromium } from '../../node_modules/playwright-core/index.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.SITE || 'http://127.0.0.1:4327';
const OUT = new URL('../public/ui/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const HIDE = `.dock, .theme-toggle, [data-theme-toggle], .home-account, .site-header { display: none !important; }
  html { scrollbar-width: none; } ::-webkit-scrollbar { display: none; }`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--lang=ru-RU'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'ru-RU' });

// где лежат кнопки и плитки — ролик наводит на них «палец» и камеру
const rects = {};
const rect = (p, sel) => p.$eval(sel, (el) => {
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.x), y: Math.round(r.y + window.scrollY), w: Math.round(r.width), h: Math.round(r.height) };
});

async function open(path, c = ctx) {
  const page = await c.newPage();
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: HIDE });
  // ленивые картинки: прокрутить вниз и обратно, чтобы все загрузились
  await page.evaluate(async () => {
    for (let y = 0; y < 8000; y += 400) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(1200);
  return page;
}

// 1. Лента главной — длинной полосой, в ролике листается внутри телефона
{
  // DPR 2: полоса длинная, а картинка выше 16 тыс. px браузеру не по силам
  const c2 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ru-RU' });
  const p = await open('/', c2);
  // плитка площадки, на которую «нажмёт» пара (координаты страницы, CSS px)
  rects.feedTile = await rect(p, 'a[href*="villa-barvikha"]');
  rects.feedH = rects.feedTile.y + 700;
  await p.screenshot({ path: OUT + 'feed.jpg', type: 'jpeg', quality: 90, clip: { x: 0, y: 0, width: 390, height: rects.feedH }, fullPage: true });
  await p.close();
}

// 2. Карточка площадки — первый экран; 3. шторка заявки, заполненная
for (const slug of ['villa-barvikha', 'led']) {
  const p = await open(`/moskva/ploshchadki/${slug}/`);
  await p.screenshot({ path: OUT + `venue-${slug}.png` });
  if (slug === 'villa-barvikha') {
    rects.bookBtn = await rect(p, '[data-booking-open]');
    rects.heart = await rect(p, '.hero-btn[data-save]');
    // в шторке — только поля и кнопка: служебные подписи в ролик не берём (Никита 08.11)
    await p.addStyleTag({ content: '.field__note, .booking__legal { display: none !important; }' });
    await p.click('[data-booking-open]');
    await p.waitForTimeout(700);
    await p.fill('[data-booking-form] input[name=name]', 'Мария');
    await p.fill('[data-booking-form] input[name=phone]', '+7 916 204-18-36');
    await p.fill('[data-booking-form] input[name=date]', '2027-06-14');
    await p.fill('[data-booking-form] textarea[name=comment]', '80 гостей, выездная регистрация в саду');
    await p.locator('[data-booking-form] textarea').blur();
    // безголовый Chromium рисует дату по-американски — показываем как у нас
    await p.$eval('[data-booking-form] input[name=date]', (el) => { el.type = 'text'; el.value = '14.06.2027'; });
    // шторку — с поля имени: видно, кто пишет, и кнопку «Отправить»
    await p.$eval('[data-booking-form] input[name=name]', (el) => el.closest('.field').scrollIntoView({ block: 'start' }));
    await p.waitForTimeout(500);
    await p.screenshot({ path: OUT + 'booking.png' });
    rects.sendBtn = await rect(p, '[data-booking-form] button[type=submit]');
  }
  await p.close();
}

// 4. Страница LЁD целиком — «сайт-презентация» листается в телефоне
{
  const c3 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ru-RU' });
  const p = await open('/moskva/ploshchadki/led/', c3);
  const h = Math.min(6000, await p.evaluate(() => document.documentElement.scrollHeight));
  rects.ledH = h;
  await p.screenshot({ path: OUT + 'venue-led-long.jpg', type: 'jpeg', quality: 90, clip: { x: 0, y: 0, width: 390, height: h }, fullPage: true });
  await p.close();
}

writeFileSync(OUT + 'rects.json', JSON.stringify(rects, null, 2) + '\n');
await browser.close();
console.log('ok →', OUT);
