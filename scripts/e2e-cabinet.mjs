// Сквозной круг кабинета через настоящие экраны (STAGE2.md, «Сквозная проверка»):
//   подрядчик заводит карточку фотографа → отправляет на проверку →
//   модератор возвращает с причиной → подрядчик правит и шлёт снова →
//   модератор одобряет → pb-pull-cabinet выгружает → визитка на дев-сервере.
//
// Только против ЛОКАЛЬНОЙ базы — боевую не трогает (тестовые карточки
// остались бы в ней, а уведомления ушли бы людям в группу модерации):
//   pb/pocketbase.exe superuser upsert <почта> <пароль> --dir research/loop-pb/pb_data
//   pb/pocketbase.exe serve --http 127.0.0.1:8091 --dir research/loop-pb/pb_data \
//     --hooksDir pb/pb_hooks --migrationsDir pb/pb_migrations      (без TG_BOT_TOKEN / TG_CHAT_ID)
//   ASTRO_DEV_BACKGROUND=1 PUBLIC_PB_URL=http://127.0.0.1:8091 \
//     npx astro dev --ignore-lock --host 127.0.0.1 --port 4392
//   PB_ADMIN_EMAIL=… PB_ADMIN_PASSWORD=… node scripts/e2e-cabinet.mjs [--keep]
//
// Окружение: E2E_PB (по умолчанию http://127.0.0.1:8091), E2E_SITE
// (http://127.0.0.1:4392), PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD — суперпользователь
// локальной базы. .env НЕ читается: там доступ к боевой базе.
// Вход подрядчика — без Telegram: учётку заводит суперпользователь, токен —
// impersonate, кладётся в localStorage под ключом кабинета (cabinet-api.ts).
// Снимки шагов — research/shots/loop/. За собой убирает учётку, ревизии,
// карточку и выгруженные файлы; --keep оставляет всё, чтобы посмотреть глазами.
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PB = (process.env.E2E_PB || 'http://127.0.0.1:8091').replace(/\/$/, '');
const SITE = (process.env.E2E_SITE || 'http://127.0.0.1:4392').replace(/\/$/, '');
const KEEP = process.argv.includes('--keep');
const SHOTS = 'research/shots/loop';
const MOD = { email: 'e2e-moderator@loop.test', password: 'e2e-loop-moderator-1' };
const PHOTOS = 'src/assets/specialists/fotografy/nirvani/gal';
const AVATAR = 'src/assets/specialists/fotografy/avatars/nirvani.webp';
const REASON = 'Первый раздел текста короткий — расскажите подробнее, как проходит съёмка.';

// предохранитель: 8090 на этой машине — туннель к боевой базе
const pbUrl = new URL(PB);
if (!['127.0.0.1', 'localhost'].includes(pbUrl.hostname) || pbUrl.port === '8090') {
  throw new Error(`E2E_PB=${PB}: прогон только против локальной базы, не 8090 (туннель к боевой)`);
}
if (!process.env.PB_ADMIN_EMAIL || !process.env.PB_ADMIN_PASSWORD) throw new Error('нужны PB_ADMIN_EMAIL и PB_ADMIN_PASSWORD локальной базы');

// ---------- база от имени суперпользователя ----------
const auth = await fetch(`${PB}/api/collections/_superusers/auth-with-password`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ identity: process.env.PB_ADMIN_EMAIL, password: process.env.PB_ADMIN_PASSWORD }),
});
if (!auth.ok) throw new Error(`суперпользователь: ${auth.status} ${await auth.text()}`);
const SU = (await auth.json()).token;
async function su(method, path, body) {
  const r = await fetch(PB + path, { method, headers: { authorization: SU, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok && r.status !== 404) throw new Error(`${method} ${path}: ${r.status} ${await r.text()}`);
  return r.status === 204 || r.status === 404 ? null : r.json();
}
const first = async (col, filter) => (await su('GET', `/api/collections/${col}/records?perPage=1&filter=${encodeURIComponent(filter)}`))?.items?.[0] ?? null;
const all = async (col, filter) => (await su('GET', `/api/collections/${col}/records?perPage=200&filter=${encodeURIComponent(filter)}`))?.items ?? [];

// условия и модератор — как pb-cabinet-setup (test-terms, moderator)
for (const [kind, checkbox] of [['vendor-offer', 'Принимаю условия размещения'], ['vendor-pdn', 'Даю согласие на обработку персональных данных']]) {
  if (!(await first('legal_docs', `kind = "${kind}"`))) {
    await su('POST', '/api/collections/legal_docs/records', { kind, version: 'test-e2e', title: `${kind} (тестовая редакция)`, checkbox, text: '<p>Тестовая редакция.</p>' });
  }
}
const modHave = await first('moderators', `email = "${MOD.email}"`);
const modBody = { email: MOD.email, password: MOD.password, passwordConfirm: MOD.password, name: 'Модератор прогона', verified: true };
if (modHave) await su('PATCH', `/api/collections/moderators/records/${modHave.id}`, modBody);
else await su('POST', '/api/collections/moderators/records', modBody);

/** учётка прогона со всем, что она завела; выгруженные файлы — только её */
const VENDOR_NAME = 'Прогон Кабинета';
async function cleanVendor(id) {
  for (const r of await all('revisions', `owner = "${id}"`)) {
    if (r.slug) {
      for (const c of await all('specialists', `slug = "${r.slug}" && categorySlug = "${r.categorySlug}"`)) await su('DELETE', `/api/collections/specialists/records/${c.id}`);
      await rm(`src/data/cabinet/specialists/${r.categorySlug}--${r.slug}.json`, { force: true });
      await rm(`src/assets/cabinet/${r.categorySlug}/${r.slug}`, { recursive: true, force: true });
    }
    await su('DELETE', `/api/collections/revisions/records/${r.id}`);
  }
  for (const s of await all('signatures', `vendor = "${id}"`)) await su('DELETE', `/api/collections/signatures/records/${s.id}`);
  await su('DELETE', `/api/collections/vendors/records/${id}`);
}
// хвосты оборванного или --keep прогона — до начала, чтобы адрес карточки не уехал в «-2»
for (const old of await all('vendors', `name = "${VENDOR_NAME}"`)) await cleanVendor(old.id);

// учётка подрядчика — как после входа Telegram: telegramId + подписи условий
const tgId = String(9e9 + Math.floor(Math.random() * 1e8));
const pass = `e2e-${Math.random().toString(36).slice(2)}-${Date.now()}`;
const vendor = await su('POST', '/api/collections/vendors/records', { telegramId: tgId, name: VENDOR_NAME, password: pass, passwordConfirm: pass });
for (const doc of await all('legal_docs', 'kind = "vendor-offer" || kind = "vendor-pdn"')) {
  await su('POST', '/api/collections/signatures/records', { vendor: vendor.id, doc: doc.id, kind: doc.kind, docVersion: doc.version, checkbox: doc.checkbox, method: 'e2e' });
}
const imp = await su('POST', `/api/collections/vendors/impersonate/${vendor.id}`, { duration: 3600 });

// ---------- браузер ----------
await rm(SHOTS, { recursive: true, force: true });
await mkdir(SHOTS, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || `${homedir()}/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe` });
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1.5, locale: 'ru-RU' };
// панель разработчика Astro на 390px перекрывает нижние кнопки — прячем
async function context() {
  const ctx = await browser.newContext(phone);
  await ctx.addInitScript(() => addEventListener('DOMContentLoaded', () => {
    const st = document.createElement('style');
    st.textContent = 'astro-dev-toolbar { display: none !important; }';
    document.head.append(st);
  }));
  return ctx;
}
const found = []; // что заметили по ходу — печатаем в конце
const errors = [];
let n = 0;
async function shot(page, name) {
  const file = join(SHOTS, `${String(++n).padStart(2, '0')}-${name}.png`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  снимок ${file}`);
}
function watch(page, who) {
  page.on('pageerror', (e) => errors.push(`${who}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(`${who}: ${m.text()}`); });
}
const step = (t) => console.log(`\n▸ ${t}`);

let revId = '';
let slug = '';
let failed = null;
try {
  const vctx = await context();
  await vctx.addInitScript(([key, value]) => { if (!localStorage.getItem(key)) localStorage.setItem(key, value); }, ['wed-cab-vendor', JSON.stringify({ token: imp.token, record: imp.record ?? vendor })]);
  const v = await vctx.newPage();
  watch(v, 'кабинет');

  // ---------- 1. подрядчик: новая карточка ----------
  step('кабинет: новая карточка «Фотографы»');
  await v.goto(`${SITE}/profi/moi/`, { waitUntil: 'networkidle' });
  await shot(v, 'moi');
  await v.click('a[data-add]');
  await v.waitForURL('**/profi/moi/novaya/');
  await v.click('button[data-cat="fotografy"]');
  await v.waitForURL(/kartochka\/\?id=/);
  revId = new URL(v.url()).searchParams.get('id');
  await v.waitForSelector('[data-submit]');
  await shot(v, 'anketa-new');

  const open = async (sec) => { await v.click(`a.c-row[href*="s=${sec}"]`); await v.waitForSelector('[data-form]'); };
  const done = async () => { await v.click('a[data-done]'); await v.waitForSelector('[data-submit], [data-withdraw]'); };
  const fill = (bind, value) => v.fill(`[data-bind="${bind}"]`, value);

  step('кабинет: основное + портрет с кадрированием');
  await open('osnovnoe');
  await fill('firstName', 'Анна');
  await fill('lastName', 'Прогонова');
  await fill('tagline', 'Репортаж без постановки, живой свет');
  await v.setInputFiles('[data-avatar]', AVATAR);
  await v.waitForSelector('dialog.c-sheet .c-crop img');
  await v.waitForTimeout(400);
  await shot(v, 'avatar-crop');
  await v.click('dialog.c-sheet [data-ok]');
  await v.waitForSelector('[data-ava] img');
  await shot(v, 'osnovnoe');
  await done();

  step('кабинет: фото');
  await open('foto');
  const files = (await readdir(PHOTOS)).filter((f) => /\.(webp|jpe?g|png)$/i.test(f)).slice(0, 9).map((f) => join(PHOTOS, f));
  await v.setInputFiles('[data-pfiles]', files);
  await v.waitForFunction((k) => document.querySelectorAll('.c-photo img').length >= k, files.length, { timeout: 120000 });
  await v.waitForSelector('[data-upload]', { state: 'hidden' });
  const photoErr = await v.$eval('[data-photo-error]', (e) => (e.hidden ? '' : e.textContent));
  if (photoErr) throw new Error(`фото: ${photoErr}`);
  // превью закрытых фото открываются токеном файла — каждое должно реально загрузиться
  for (const img of await v.$$('.c-photo img')) await img.scrollIntoViewIfNeeded();
  await v.waitForTimeout(1500);
  const broken = await v.$$eval('.c-photo img', (xs) => xs.filter((x) => !x.complete || !x.naturalWidth).length);
  if (broken) found.push(`фото в анкете: ${broken} превью не загрузились`);
  await shot(v, 'foto');
  await done();

  step('кабинет: текст двумя разделами');
  await open('tekst');
  await v.click('[data-add="sections"]');
  await v.click('[data-add="sections"]');
  await fill('sections.0.title', 'Как я снимаю');
  await fill('sections.0.body', 'Снимаю свадьбы репортажно: без долгих постановок и команд «улыбаемся».\n\nЧто входит в день:\n— сборы невесты\n— регистрация и прогулка\n— банкет до первого танца');
  await fill('sections.1.title', 'После свадьбы');
  await fill('sections.1.body', 'Первые двадцать кадров присылаю через три дня, всю съёмку — через месяц. Цвет и свет довожу вручную, без пресетов на поток.');
  await shot(v, 'tekst');
  await done();

  step('кабинет: вопросы');
  await open('voprosy');
  for (const g of await v.$$('.c-q')) await (await g.$('.c-opt'))?.click();
  await shot(v, 'voprosy');
  await done();

  step('кабинет: цена тарифами');
  await open('prays');
  await v.click('[data-pmode="tariffs"]');
  await v.waitForSelector('[data-bind="tariffs.0.name"]');
  await fill('tariffs.0.name', 'Камерная');
  await fill('tariffs.0.price', '45000');
  await fill('tariffs.0.unit', 'за 4 часа');
  await fill('tariffs.0.includes', '4 часа съёмки\n200 кадров в обработке\nонлайн-галерея');
  await v.click('[data-add="tariffs"]');
  await fill('tariffs.1.name', 'Весь день');
  await fill('tariffs.1.price', '90000');
  await fill('tariffs.1.unit', 'за 10 часов');
  await fill('tariffs.1.includes', '10 часов съёмки\n600 кадров в обработке\nфотокнига');
  await shot(v, 'prays');
  await done();

  step('кабинет: контакты');
  await open('kontakty');
  await v.fill('[data-phone]', '9161234567');
  await fill('contacts.telegram', 't.me/anna_progon');
  await v.locator('[data-bind="contacts.site"]').focus(); // уход с поля — нормализация ника
  await shot(v, 'kontakty');
  const tg = await v.inputValue('[data-bind="contacts.telegram"]');
  if (tg !== '@anna_progon') found.push(`Telegram после ухода с поля: «${tg}», ждали «@anna_progon»`);
  await done();

  step('кабинет: отправить на проверку');
  await shot(v, 'anketa-filled');
  await v.click('[data-submit]');
  await v.waitForSelector('[data-withdraw], [data-error]:not([hidden])');
  const subErr = await v.$eval('[data-error]', (e) => (e.hidden ? '' : e.textContent));
  if (subErr) throw new Error(`отправка: ${subErr}`);
  await shot(v, 'submitted');
  slug = (await su('GET', `/api/collections/revisions/records/${revId}`)).slug;
  console.log(`  ревизия ${revId}, адрес ${slug}`);

  // ---------- 2. модератор: вернуть с причиной ----------
  step('админка: вход модератора');
  const mctx = await context();
  const m = await mctx.newPage();
  watch(m, 'админка');
  await m.goto(`${SITE}/profi/admin/vhod/`, { waitUntil: 'networkidle' });
  await m.fill('input[name=email]', MOD.email);
  await m.fill('input[name=password]', MOD.password);
  await shot(m, 'admin-login');
  await m.click('button[type=submit]');
  await m.waitForURL('**/profi/admin/moderaciya/');
  const row = `a[href="/profi/admin/moderaciya/pravka/?id=${revId}"]`;
  await m.waitForSelector(row, { timeout: 15000 });
  const rowText = await m.$eval(row, (a) => a.closest('tr')?.textContent ?? a.textContent);
  if (!/Проверить новую карточку/.test(rowText)) found.push(`строка в «Модерации» без «Проверить новую карточку»: ${rowText.replace(/\s+/g, ' ').trim()}`);
  await shot(m, 'moderation');
  await m.click(row);
  await m.waitForSelector('[data-pr-acts]:not([hidden])');
  await m.waitForFunction(() => document.querySelectorAll('[data-pr-photos] img').length > 0);
  await shot(m, 'pravka');
  await m.fill('[data-pr-reason]', REASON);
  await m.click('[data-pr-reject]');
  await m.waitForSelector('[data-pr-state] .status--bad');
  await shot(m, 'rejected');

  // ---------- 3. подрядчик: видит причину, правит, шлёт снова ----------
  step('кабинет: причина, правка, повторная отправка');
  await v.goto(`${SITE}/profi/moi/kartochka/?id=${revId}`, { waitUntil: 'networkidle' });
  await v.waitForSelector('.c-reason');
  const seen = await v.textContent('.c-reason');
  if (!seen.includes(REASON)) throw new Error(`подрядчик не видит причину: ${seen}`);
  await shot(v, 'reason');
  await open('tekst');
  await fill('sections.0.body', 'Снимаю свадьбы репортажно: без долгих постановок и команд «улыбаемся». Утром приезжаю к невесте, к вечеру знаю всех гостей по именам — поэтому в кадре живые лица, а не позы.\n\nЧто входит в день:\n— сборы невесты\n— регистрация и прогулка\n— банкет до первого танца');
  await done();
  await v.click('[data-submit]');
  await v.waitForSelector('[data-withdraw], [data-error]:not([hidden])');
  const subErr2 = await v.$eval('[data-error]', (e) => (e.hidden ? '' : e.textContent));
  if (subErr2) throw new Error(`повторная отправка: ${subErr2}`);
  await shot(v, 'resubmitted');

  // ---------- 4. модератор: одобрить ----------
  step('админка: одобрить');
  await m.goto(`${SITE}/profi/admin/moderaciya/`, { waitUntil: 'networkidle' });
  await m.waitForSelector(row, { timeout: 15000 });
  await m.click(row);
  await m.waitForSelector('[data-pr-acts]:not([hidden])');
  await m.click('[data-pr-approve]');
  await m.waitForSelector('[data-pr-state] .status--ok, [data-pr-error]:not([hidden])');
  const apErr = await m.$eval('[data-pr-error]', (e) => (e.hidden ? '' : e.textContent));
  if (apErr) throw new Error(`одобрение: ${apErr}`);
  await shot(m, 'approved');

  // ---------- 5. выгрузка и визитка ----------
  step('выгрузка pb-pull-cabinet');
  console.log(execFileSync(process.execPath, ['scripts/pb-pull-cabinet.mjs'], { env: { ...process.env, PB_PUBLIC_URL: PB }, encoding: 'utf8' }).trim());
  const json = `src/data/cabinet/specialists/fotografy--${slug}.json`;
  if (!existsSync(json)) throw new Error(`нет ${json}`);
  const card = JSON.parse(await readFile(json, 'utf8'));
  console.log(`  ${json}: ${card.photos.length} фото, разделов ${card.story.length}`);

  step('визитка на дев-сервере');
  const page = `${SITE}/moskva/podryadchiki/fotografy/${slug}/`;
  // дев-сервер подхватывает новый JSON не мгновенно и на нём перезагружается
  // (переход обрывается ERR_ABORTED) — несколько попыток
  let status = 0;
  for (let i = 0; i < 10 && status !== 200; i++) {
    try { status = (await v.goto(page, { waitUntil: 'networkidle' }))?.status() ?? 0; } catch { status = 0; }
    if (status !== 200) await v.waitForTimeout(1500);
  }
  if (status !== 200) throw new Error(`${page}: ${status}`);
  const body = await v.textContent('body');
  for (const want of ['Анна Прогонова', 'Как я снимаю', 'После свадьбы', 'Тарифы', 'Камерная', 'за 4 часа', 'Весь день', 'за 10 часов', '200 кадров в обработке']) {
    if (!body.includes(want)) found.push(`на визитке нет «${want}»`);
  }
  if (body.indexOf('Что входит в день') > body.indexOf('сборы невесты')) found.push('на визитке подводка «Что входит в день:» стоит после списка');
  await shot(v, 'site-card');
  console.log(`  ${page}`);
} catch (err) {
  failed = err;
} finally {
  await browser.close();
  if (KEEP) {
    console.log(`\n--keep: учётка ${vendor.id}, ревизия ${revId}, карточка ${slug} оставлены`);
  } else {
    await cleanVendor(vendor.id);
    console.log('\nубрано: учётка, ревизии, карточка, выгруженные файлы');
  }
}

if (errors.length) found.push(...[...new Set(errors)].map((e) => `ошибка в браузере — ${e}`));
console.log(found.length ? `\nНайдено:\n${found.map((x) => `— ${x}`).join('\n')}` : '\nНайдено: ничего');
if (failed) { console.error(`\nКРУГ ОБОРВАЛСЯ: ${failed.message}`); process.exit(1); }
console.log('\nКруг пройден.');
