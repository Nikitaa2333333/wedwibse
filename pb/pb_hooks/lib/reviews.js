/// <reference path="../../pb_data/types.d.ts" />
// ============================================================
// ОТЗЫВЫ НЕВЕСТ (12.11.2026, docs/cabinet/REVIEWS.md).
//
// Невеста пишет отзыв в коллекцию reviews (createRule — только brides).
// Всё, что решает судьбу отзыва, ставит этот хук, а не запрос: автор —
// вошедшая учётка, статус — «на модерации». Публикует модератор
// (updateRule — только moderators): меняет только status и rejectReason.
// На сайте отзыв появляется после одобрения (live-data берёт approved).
// ============================================================

const BRIDE_FIELDS = ['venue', 'specialist', 'authorName', 'rating', 'text', 'weddingMonth', 'photos'];
const MIN_TEXT = 20;
const MAX_PHOTOS = 5;

function cab() {
  return require(`${__hooks}/lib/cabinet.js`);
}

function monthNow() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** карточка отзыва: ровно одна, опубликованная */
function cardOf(app, r) {
  const venueId = r.getString('venue');
  const specialistId = r.getString('specialist');
  if (!!venueId === !!specialistId) throw new BadRequestError('Отзыв пишется об одной площадке или одном подрядчике.');
  let card = null;
  try {
    card = app.findRecordById(venueId ? 'venues' : 'specialists', venueId || specialistId);
  } catch (_) {}
  if (!card || card.getString('status') !== 'published') throw new BadRequestError('Карточка не найдена — возможно, её сняли с сайта.');
  return { card, kind: venueId ? 'venue' : 'specialist', field: venueId ? 'venue' : 'specialist', id: venueId || specialistId };
}

/** onRecordCreateRequest reviews — от невесты */
function brideCreateReview(e) {
  const c = cab();
  c.denyExtra(e.requestInfo().body, BRIDE_FIELDS);
  const r = e.record;
  const app = e.app;
  r.set('bride', e.auth.id);
  r.set('status', 'pending');
  r.set('rejectReason', '');
  r.set('reviewedAt', '');

  const { card, field, id } = cardOf(app, r);
  if (c.findOne(app, 'reviews', `bride = {:b} && ${field} = {:id}`, { b: e.auth.id, id })) {
    throw new BadRequestError('Вы уже оставили отзыв об этой карточке. Его можно удалить в «Моих отзывах» и написать заново.');
  }

  const rating = r.getInt('rating');
  if (rating < 1 || rating > 5) throw new BadRequestError('Поставьте оценку от 1 до 5.');

  const text = c.str(r.getString('text'), 4000);
  if (text.length < MIN_TEXT) throw new BadRequestError('Расскажите чуть подробнее — хотя бы пару предложений.');
  r.set('text', text);

  const month = r.getString('weddingMonth');
  if (month && month > monthNow()) throw new BadRequestError('Отзыв оставляют после свадьбы — проверьте месяц.');

  const n = r.getStringSlice('photos').filter(Boolean).length + r.getUnsavedFiles('photos').length;
  if (n > MAX_PHOTOS) throw new BadRequestError(`К отзыву — до ${MAX_PHOTOS} фото.`);

  const bride = app.findRecordById('brides', e.auth.id);
  let name = c.str(r.getString('authorName'), 80) || c.str(bride.getString('name'), 80);
  if (!name) throw new BadRequestError('Укажите имя — оно будет стоять под отзывом.');
  r.set('authorName', name);

  e.next();

  // имя в учётке ещё не стоит — берём подпись отзыва
  if (!bride.getString('name')) {
    try {
      bride.set('name', name);
      app.save(bride);
    } catch (_) {}
  }
  c.telegram(`Отзыв на модерацию: ${card.getString('name')} — ${'★'.repeat(rating)}, ${name}.\n${c.SITE_URL}/profi/admin/otzyvy/`);
}

/** onRecordUpdateRequest reviews — решение модератора */
function moderateReview(e) {
  const c = cab();
  const body = e.requestInfo().body || {};
  for (const key of Object.keys(body)) {
    if (key !== 'status' && key !== 'rejectReason') throw new BadRequestError('Модератор меняет только решение по отзыву.');
  }
  const r = e.record;
  const status = r.getString('status');
  if (['approved', 'rejected', 'pending'].indexOf(status) === -1) throw new BadRequestError('Неизвестный статус.');
  if (status === 'rejected' && !c.str(r.getString('rejectReason'), 1000)) throw new BadRequestError('Напишите причину — её увидит автор.');
  if (status !== 'rejected') r.set('rejectReason', '');
  const before = r.original().getString('status');
  r.set('reviewedAt', status === 'pending' ? '' : new DateTime());
  e.next();
  if (before !== status && status !== 'pending') mailBride(e.app, r, status);
}

/** письмо автору о решении; учётка без почты (вход мессенджером) — без письма */
function mailBride(app, r, status) {
  try {
    const bride = app.findRecordById('brides', r.getString('bride'));
    if (!bride.email()) return;
    const c = cab();
    const field = r.getString('venue') ? 'venue' : 'specialist';
    const card = app.findRecordById(field === 'venue' ? 'venues' : 'specialists', r.getString(field));
    const name = card.getString('name');
    const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
    const html = status === 'approved'
      ? `<p>Здравствуйте!</p><p>Ваш отзыв о «${esc(name)}» опубликован. Спасибо, что поделились — он поможет другим парам.</p><p><a href="${c.SITE_URL}/moy/">Мои отзывы</a></p><p>— Wed Secrets</p>`
      : `<p>Здравствуйте!</p><p>Отзыв о «${esc(name)}» мы не опубликовали. Причина: ${esc(r.getString('rejectReason'))}</p><p>Его можно удалить и написать заново: <a href="${c.SITE_URL}/moy/">Мои отзывы</a></p><p>— Wed Secrets</p>`;
    const meta = app.settings().meta;
    app.newMailClient().send(new MailerMessage({
      from: { address: meta.senderAddress, name: meta.senderName || meta.appName },
      to: [{ address: bride.email() }],
      subject: status === 'approved' ? 'Ваш отзыв опубликован — Wed Secrets' : 'Отзыв не опубликован — Wed Secrets',
      html,
    }));
  } catch (err) {
    app.logger().warn('reviews: письмо автору не ушло', 'review', r.id, 'error', String(err));
  }
}

module.exports = { brideCreateReview, moderateReview };
