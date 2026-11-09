// Настройка базы кабинета для сквозной проверки (STAGE2.md, «Сквозная проверка»):
//   node scripts/pb-cabinet-setup.mjs moderator <почта> <пароль> [имя]  — завести / сменить пароль модератору
//   node scripts/pb-cabinet-setup.mjs test-terms                       — тестовая редакция условий, если в базе нет никакой
//   node scripts/pb-cabinet-setup.mjs invite <kat>/<slug> [заметка]    — личная ссылка на карточку подрядчика (venue:<slug> — площадки)
//   node scripts/pb-cabinet-setup.mjs venue-forms [--write] [slug …]   — анкета «ведём мы» нашим площадкам (09.11)
//   node scripts/pb-cabinet-setup.mjs invite-pilot --venues            — ссылки пачкой площадкам «ведём мы»
// Доступ — PB_URL, PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD (.env); к серверу —
// через туннель: bash scripts/pb-tunnel.sh.
//
// Тестовая редакция условий — НЕ юридический текст: она открывает
// регистрацию на время проверки пути своими силами. До приглашения
// настоящих подрядчиков её заменяет текст юриста (новая запись
// legal_docs того же вида — действует последняя, подписи старой остаются).
import { createHash, randomBytes } from 'node:crypto';
import { loadEnv, pb } from './pb-lib.mjs';

const cfg = await loadEnv();
const api = await pb(cfg);
const [cmd, ...args] = process.argv.slice(2);
const SITE = (process.env.SITE_URL || 'https://wed-secrets.ru').replace(/\/$/, '');

if (cmd === 'moderator') {
  const [email, password, name = ''] = args;
  if (!email || !password || password.length < 10) throw new Error('нужны почта и пароль от 10 знаков');
  const have = await api.first('moderators', `email = "${email}"`);
  const body = { email, password, passwordConfirm: password, name, verified: true };
  if (have) await api.update('moderators', have.id, body);
  else await api.create('moderators', body);
  console.log(`модератор ${email}: ${have ? 'пароль обновлён' : 'заведён'} — вход ${SITE}/profi/admin/vhod/`);
} else if (cmd === 'test-terms') {
  const docs = [
    ['vendor-offer', 'Условия размещения (тестовая редакция)', 'Принимаю условия размещения'],
    ['vendor-pdn', 'Согласие на обработку персональных данных (тестовая редакция)', 'Даю согласие на обработку персональных данных'],
  ];
  for (const [kind, title, checkbox] of docs) {
    if (await api.first('legal_docs', `kind = "${kind}"`)) { console.log(`${kind}: редакция уже есть, не трогаю`); continue; }
    await api.create('legal_docs', {
      kind, version: 'test-' + new Date().toISOString().slice(0, 10), title, checkbox,
      text: '<p>Тестовая редакция для проверки кабинета командой WED Secrets. Не является офертой. ' +
        'До приглашения подрядчиков её заменит текст юриста.</p>',
    });
    console.log(`${kind}: тестовая редакция заведена`);
  }
} else if (cmd === 'invite') {
  const [ref, note = ''] = args;
  const venue = ref?.startsWith('venue:');
  const [cat, slug] = venue ? ['', ref.slice(6)] : (ref ?? '').split('/');
  const card = venue
    ? await api.first('venues', `slug = "${slug}"`)
    : await api.first('specialists', `categorySlug = "${cat}" && slug = "${slug}"`);
  if (!card) throw new Error(`карточка ${ref} не найдена в базе`);
  const key = randomBytes(24).toString('base64url');
  await api.create('invites', {
    tokenHash: createHash('sha256').update(key).digest('hex'),
    [venue ? 'venue' : 'specialist']: card.id,
    expiresAt: new Date(Date.now() + 30 * 86400000).toISOString().replace('T', ' '),
    note,
  });
  // ключ показывается один раз: в базе только его хэш
  console.log(`${card.name}: ${SITE}/profi/vhod/?invite=${key}`);
} else if (cmd === 'release') {
  // Отвязать карточку «ведём мы» от учётки после теста (пилот, 03.11):
  // владелец снимается, правки и ревизии теста удаляются, анкета — заново
  // из нашего JSON, цена и ответы на сайте — снова из git. После этого
  // на карточку можно выдать ссылку настоящему владельцу.
  //   node scripts/pb-cabinet-setup.mjs release <kat>/<slug> …
  const { readFile } = await import('node:fs/promises');
  const { cardToForm } = await import('./card-to-form.mjs');
  for (const ref of args) {
    const [cat, slug] = ref.split('/');
    const card = await api.first('specialists', `categorySlug = "${cat}" && slug = "${slug}"`);
    if (!card) { console.log(`${ref}: нет в базе`); continue; }
    if (card.form?.managed !== true) { console.log(`${ref}: не «ведём мы», не трогаю`); continue; }
    const json = JSON.parse(await readFile(`src/data/specialists/${cat}/${slug}.json`, 'utf8'));
    const revs = (await api.list('revisions', `filter=${encodeURIComponent(`specialist = "${card.id}"`)}`))?.items ?? [];
    for (const r of revs) await api.remove('revisions', r.id);
    const invs = (await api.list('invites', `filter=${encodeURIComponent(`specialist = "${card.id}"`)}`))?.items ?? [];
    for (const i of invs) await api.remove('invites', i.id);
    const page = { ...(card.page ?? {}) };
    delete page.ownerEdits;
    await api.update('specialists', card.id, {
      owner: '', form: cardToForm(json), contacts: {}, page,
      priceFrom: json.priceFrom ?? null, filters: json.filters ?? {},
    });
    console.log(`${ref}: отвязана (ревизий ${revs.length}, приглашений ${invs.length})`);
  }
} else if (cmd === 'venue-forms') {
  // Площадки «ведём мы» (Никита 09.11): анкета кабинета в поле form наших площадок.
  //   node scripts/pb-cabinet-setup.mjs venue-forms [slug …]          — сухой прогон: что попадёт
  //   node scripts/pb-cabinet-setup.mjs venue-forms --write [slug …]  — записать (только без владельца)
  // Площадки из кабинета (page.source = 'cabinet') не трогаем: у них своя анкета.
  const { venueToForm } = await import('./venue-to-form.mjs');
  const write = args.includes('--write');
  const only = args.filter((a) => !a.startsWith('--'));
  const list = (await api.list('venues', `filter=${encodeURIComponent('status = "published"')}`))?.items ?? [];
  for (const card of list) {
    if (only.length && !only.includes(card.slug)) continue;
    if (card.page?.source === 'cabinet') { console.log(`${card.slug}: из кабинета, пропуск`); continue; }
    if (card.owner) { console.log(`${card.slug}: есть владелец — анкету не перезаписываю`); continue; }
    const form = venueToForm(card);
    console.log(`${card.slug}: строк ${form.rows.length}, залов с тарифом ${form.hallTariffs.length}, тип «${form.type}», чек ${form.checkFrom ?? '—'}, гостей ${form.capacityBanquet ?? '—'}`);
    if (write) await api.update('venues', card.id, { form });
  }
  if (!write) console.log('\nсухой прогон — записать: добавьте --write');
} else if (cmd === 'invite-pilot') {
  // Пилот (STAGE2.md, 03.11): ссылки пачкой на карточки «ведём мы» без
  // владельца → research/pilot-links.csv (в git не попадает). Столбец «кому»
  // заполняет Никита; рассылает тоже он — скрипт никому ничего не шлёт.
  // Можно ограничить: invite-pilot <kat>/<slug> …
  const { mkdir, writeFile } = await import('node:fs/promises');
  // --venues — площадкам (09.11): ref — venue:<slug>; анкета — venue-forms --write
  const venues = args.includes('--venues');
  const only = args.filter((a) => !a.startsWith('--'));
  const list = (await api.list(venues ? 'venues' : 'specialists', `filter=${encodeURIComponent('owner = "" && status = "published"')}`))?.items ?? [];
  const rows = [['карточка', 'имя', 'ссылка', 'действует до', 'кому']];
  for (const card of list) {
    const ref = venues ? `venue:${card.slug}` : `${card.categorySlug}/${card.slug}`;
    if (only.length && !only.includes(ref)) continue;
    if (card.form?.managed !== true) { console.log(`${ref}: нет анкеты (${venues ? 'venue-forms --write' : 'card-to-form.mjs --write'}), пропуск`); continue; }
    const key = randomBytes(24).toString('base64url');
    const until = new Date(Date.now() + 30 * 86400000);
    await api.create('invites', {
      tokenHash: createHash('sha256').update(key).digest('hex'),
      [venues ? 'venue' : 'specialist']: card.id,
      expiresAt: until.toISOString().replace('T', ' '),
      note: 'пилот 03.11',
    });
    rows.push([ref, card.name, `${SITE}/profi/vhod/?invite=${key}`, until.toISOString().slice(0, 10), '']);
    console.log(`${ref}: ссылка выдана`);
  }
  await mkdir('research', { recursive: true });
  const csv = rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  await writeFile(venues ? 'research/pilot-links-venues.csv' : 'research/pilot-links.csv', '﻿' + csv + '\r\n');
  console.log(`\n${rows.length - 1} ссылок → research/pilot-links${venues ? '-venues' : ''}.csv (ключи показаны один раз, в базе только хэш)`);
} else {
  console.log('команды: moderator <почта> <пароль> [имя] | test-terms | invite <kat>/<slug>|venue:<slug> [заметка] | invite-pilot [--venues] [<kat>/<slug>|venue:<slug> …] | venue-forms [--write] [slug …] | release <kat>/<slug> …');
  process.exit(1);
}
