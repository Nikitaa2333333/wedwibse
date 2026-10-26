// Настройка базы кабинета для сквозной проверки (STAGE2.md, «Сквозная проверка»):
//   node scripts/pb-cabinet-setup.mjs moderator <почта> <пароль> [имя]  — завести / сменить пароль модератору
//   node scripts/pb-cabinet-setup.mjs test-terms                       — тестовая редакция условий, если в базе нет никакой
//   node scripts/pb-cabinet-setup.mjs invite <kat>/<slug> [заметка]    — личная ссылка на карточку подрядчика (venue:<slug> — площадки)
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
} else {
  console.log('команды: moderator <почта> <пароль> [имя] | test-terms | invite <kat>/<slug>|venue:<slug> [заметка]');
  process.exit(1);
}
