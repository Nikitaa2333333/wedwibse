/// <reference path="../../pb_data/types.d.ts" />
// ============================================================
// ВХОД ЧЕРЕЗ MAX — бот и его вебхук (CABINET.md §23).
// https://dev.max.ru/docs-api — Bot API: ключ в заголовке Authorization,
// вебхук приходит с секретом в X-Max-Bot-Api-Secret.
//
// Окружение базы: MAX_BOT_TOKEN (ключ бота), MAX_BOT_NAME (никнейм,
// id…_bot), MAX_WEBHOOK_SECRET (секрет подписки), MAX_API — адрес Bot API,
// если поменяется.
// ============================================================

// platform-api2 из доков с нашего VPS не открывается (30.10.2026), platform-api — да
const API = ($os.getenv('MAX_API') || 'https://platform-api.max.ru').replace(/\/$/, '');
/** код входа живёт столько: открыл MAX, нажал «Начать», вернулся на сайт */
const CODE_TTL_MIN = 15;
const CODE_RE = /^[a-z0-9]{32}$/;

// Тексты бота. Меняются только с согласия Никиты: это сообщения людям.
// Домена в текстах нет (31.10): MAX сам делает из него ссылку на главную,
// а ссылка на кабинет откроется во встроенном браузере MAX без входа —
// кабинет уже открыт там, откуда человек нажал кнопку.
const TEXT_DONE = 'Готово, вход подтверждён. Вернитесь в браузер — кабинет уже открылся там.';
const TEXT_STALE = 'Эта ссылка для входа устарела. Нажмите «Войти через MAX» на сайте ещё раз.';
const TEXT_HELP = 'Это бот входа в кабинет подрядчика WED Secrets. Чтобы войти, нажмите «Войти через MAX» на странице входа в кабинет.';

/** сообщение пользователю в диалог с ботом; отказ MAX только в лог */
function send(userId, text) {
  const token = $os.getenv('MAX_BOT_TOKEN');
  if (!token || !userId) return;
  try {
    const res = $http.send({
      url: `${API}/messages?user_id=${encodeURIComponent(userId)}`,
      method: 'POST',
      headers: { Authorization: token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      timeout: 10,
    });
    if (res.statusCode !== 200) {
      $app.logger().warn('max: сообщение не ушло', 'status', res.statusCode, 'body', toString(res.body).slice(0, 500));
    }
  } catch (err) {
    $app.logger().warn('max: Bot API не ответил', 'error', String(err));
  }
}

function userName(u) {
  const name = String((u && (u.name || [u.first_name, u.last_name].filter(Boolean).join(' '))) || '').trim();
  return name.slice(0, 120);
}

function findLogin(app, code) {
  if (!CODE_RE.test(String(code || ''))) return null;
  try {
    return app.findFirstRecordByFilter('max_logins', 'codeHash = {:h}', { h: $security.sha256(code) });
  } catch (_) {
    return null;
  }
}

function expired(login) {
  return login.getDateTime('expiresAt').unix() < Math.floor(Date.now() / 1000);
}

/** POST /api/wed/max/start — одноразовый код и ссылка в бота */
function start(e) {
  const bot = $os.getenv('MAX_BOT_NAME');
  if (!bot || !$os.getenv('MAX_BOT_TOKEN')) throw new BadRequestError('Вход через MAX ещё не настроен.');
  // старые коды убираем здесь же: отдельного расписания не заводим
  const now = new Date().toISOString().replace('T', ' ');
  for (const r of e.app.findRecordsByFilter('max_logins', 'expiresAt < {:now}', '', 100, 0, { now })) e.app.delete(r);

  const code = $security.randomStringWithAlphabet(32, 'abcdefghijklmnopqrstuvwxyz0123456789');
  const login = new Record(e.app.findCollectionByNameOrId('max_logins'));
  login.set('codeHash', $security.sha256(code));
  login.set('expiresAt', new Date(Date.now() + CODE_TTL_MIN * 60000).toISOString().replace('T', ' '));
  e.app.save(login);
  return e.json(200, { code, link: `https://max.ru/${bot}?start=${code}` });
}

/**
 * POST /api/wed/max/webhook — события бота. MAX повторяет доставку, пока
 * не получит 200, поэтому на всё, кроме чужого секрета, отвечаем 200.
 */
function webhook(e) {
  const secret = $os.getenv('MAX_WEBHOOK_SECRET');
  const got = String(e.request.header.get('X-Max-Bot-Api-Secret') || '');
  if (!secret || !$security.equal(got, secret)) throw new UnauthorizedError('');

  const body = e.requestInfo().body || {};
  try {
    if (body.update_type === 'bot_started') {
      const u = body.user || {};
      const id = String(u.user_id || '');
      if (!/^\d{1,20}$/.test(id)) return e.json(200, { ok: true });
      const login = findLogin(e.app, body.payload);
      if (!login) {
        send(id, body.payload ? TEXT_STALE : TEXT_HELP);
      } else if (expired(login) || (login.getString('maxId') && login.getString('maxId') !== id)) {
        send(id, TEXT_STALE);
      } else {
        login.set('maxId', id);
        login.set('name', userName(u));
        e.app.save(login);
        send(id, TEXT_DONE);
      }
    } else if (body.update_type === 'message_created') {
      const m = body.message || {};
      const sender = m.sender || {};
      // в диалоге отвечаем подсказкой; в группах бот молчит
      if (!sender.is_bot && (!m.recipient || m.recipient.chat_type === 'dialog')) send(String(sender.user_id || ''), TEXT_HELP);
    }
  } catch (err) {
    $app.logger().warn('max: вебхук не разобран', 'error', String(err));
  }
  return e.json(200, { ok: true });
}

/**
 * код → аккаунт MAX, если человек уже нажал «Начать» в боте.
 * null — ещё не нажал; ошибка — кода нет или он устарел.
 */
function confirmed(app, code) {
  const login = findLogin(app, code);
  if (!login || expired(login)) throw new BadRequestError('Вход через MAX устарел — нажмите кнопку ещё раз.');
  const id = login.getString('maxId');
  return id ? { login, id, name: login.getString('name') } : null;
}

module.exports = { start, webhook, confirmed, send, CODE_RE };
