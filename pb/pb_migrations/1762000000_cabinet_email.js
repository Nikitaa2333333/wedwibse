/// <reference path="../pb_data/types.d.ts" />
// ============================================================
// ВХОД ПО ПОЧТЕ — коды из письма (CABINET.md §9, §21).
//
// Одно письмо с кодом на три случая: подтвердить почту после регистрации,
// войти, если почта ещё не подтверждена, и задать новый пароль. Поэтому
// текст не называет действие — только код. Текст письма меняется только
// с согласия Никиты: это сообщение людям.
//
// Маршруты /api/wed/register и /api/wed/password-reset открыты без входа —
// потолок частоты на адрес (подбор кода, регистрация пачками).
// ============================================================

migrate(
  (app) => {
    const vendors = app.findCollectionByNameOrId('vendors');
    vendors.otp.emailTemplate = {
      subject: 'Код для кабинета WED Secrets: {OTP}',
      body:
        '<p>Здравствуйте!</p>' +
        '<p>Ваш код: <strong style="font-size:22px;letter-spacing:2px">{OTP}</strong></p>' +
        '<p>Введите его на сайте wed-secrets.ru. Код действует 10 минут.</p>' +
        '<p>Если вы не запрашивали код — просто удалите это письмо, с учёткой ничего не случится.</p>' +
        '<p>— WED Secrets</p>',
    };
    app.save(vendors);

    const s = app.settings();
    const add = (label, maxRequests, duration) => {
      if (!s.rateLimits.rules.some((r) => r.label === label)) s.rateLimits.rules.push({ label, maxRequests, duration, audience: '' });
    };
    add('POST /api/wed/register', 10, 600);
    add('POST /api/wed/password-reset', 10, 600);
    add('POST /api/wed/confirm', 10, 600);
    app.save(s);
  },
  (app) => {
    const ours = ['POST /api/wed/register', 'POST /api/wed/password-reset', 'POST /api/wed/confirm'];
    const s = app.settings();
    s.rateLimits.rules = s.rateLimits.rules.filter((r) => !ours.includes(r.label));
    app.save(s);
  }
);
