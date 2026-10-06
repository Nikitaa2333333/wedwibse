/// <reference path="../../pb_data/types.d.ts" />
// ============================================================
// ЛОГИКА КАБИНЕТА ПОДРЯДЧИКА — общая для хуков cabinet.pb.js.
//
// Обработчики pb_hooks исполняются каждый в своей изолированной VM:
// функции верхнего уровня *.pb.js внутри обработчика не видны. Поэтому
// всё общее живёт здесь, а обработчик подключает модуль через require().
//
// Кто что может (подробно — CABINET.md):
//   подрядчик  — только свои ревизии, только белый список полей,
//                статусы draft ⇄ review; карточки сайта не трогает вовсе
//   модератор  — review → approved | rejected; approved переносит
//                ревизию в карточку (venues / specialists) одной транзакцией
// ============================================================

/** фото на карточке, без которых её нет смысла показывать в каталоге */
const MIN_PHOTOS = 8;
/** «о себе» короче этого — визитка выйдет пустой (CABINET.md, 11.4) */
const MIN_ABOUT = 150;
/** ревизия ещё не закрыта модератором */
const OPEN_FILTER = '(status = "draft" || status = "review" || status = "rejected")';
const SITE_URL = ($os.getenv('SITE_URL') || 'https://wed-secrets.ru').replace(/\/$/, '');

// ---------- контакты в тексте ----------
// Контакты живут только в блоке «Контакты» — клиент открывает их кнопкой
// (CABINET.md, раздел 8). Телефон или ник в «О себе» обходит эту кнопку.
// Проверяем при отправке на модерацию, а не при каждом автосохранении:
// автосохранение, которое отказывается сохранять, теряет набранный текст.
const CONTACT_PATTERNS = [
  // +7 916 123-45-67, 8 (916) 123 45 67; «2018» и «150 000 – 300 000» не ловит:
  // нужна 7 или 8 в начале числа и группы 3-3-2-2
  { re: /(?:\+7|\b[78])[\s\-()]*\d{3}[\s\-()]*\d{3}[\s\-]*\d{2}[\s\-]*\d{2}(?!\d)/, what: 'телефон' },
  { re: /\b9\d{2}[\s\-()]*\d{3}[\s\-]*\d{2}[\s\-]*\d{2}(?!\d)/, what: 'телефон' },
  { re: /[\w.+-]+@[\w-]+\.[a-zа-я]{2,}/i, what: 'почта' },
  { re: /https?:\/\/|www\./i, what: 'ссылка' },
  { re: /\b(?:t\.me|wa\.me|vk\.com|vk\.cc|taplink\.cc|instagram\.com|youtu\.be|youtube\.com)\b/i, what: 'ссылка' },
  { re: /\b[a-z0-9-]{2,}\.(?:ru|com|net|org|su|pro|me|io|art|online|site|studio|photo|moscow|space)\b/i, what: 'адрес сайта' },
  { re: /[а-яё0-9-]{2,}\.рф/i, what: 'адрес сайта' },
  { re: /(?:^|[\s(«"])@[a-z0-9_.]{3,}/i, what: 'ник в мессенджере' },
];

/** первое найденное контактное данное в тексте шаблона (кроме блока contacts) */
function findContact(value, path) {
  if (typeof value === 'string') {
    for (const p of CONTACT_PATTERNS) if (p.re.test(value)) return { path, what: p.what };
    return null;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const hit = findContact(value[i], path);
      if (hit) return hit;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    for (const k of Object.keys(value)) {
      if (k === 'contacts') continue;
      const hit = findContact(value[k], path ? path + '.' + k : k);
      if (hit) return hit;
    }
  }
  return null;
}

/** как поле шаблона называется у подрядчика в форме */
const FIELD_LABELS = {
  name: 'Название', tagline: 'Коротко о себе', about: 'О себе', priceNote: 'Про цену',
  address: 'Адрес', halls: 'Залы', filters: 'Ответы на вопросы',
};
function fieldLabel(path) {
  const root = String(path || '').split('.')[0];
  return FIELD_LABELS[root] || root;
}

// ---------- адрес страницы ----------
const TR = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k',
  л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts',
  ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};
function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .split('')
    .map((ch) => (ch in TR ? TR[ch] : ch))
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');
}

const cardCollection = (kind) => (kind === 'venue' ? 'venues' : 'specialists');
const cardField = (kind) => (kind === 'venue' ? 'venue' : 'specialist');
const cardUrl = (kind, category, slug) =>
  kind === 'venue' ? `${SITE_URL}/moskva/ploshchadki/${slug}/` : `${SITE_URL}/moskva/podryadchiki/${category}/${slug}/`;

function findOne(app, collection, filter, params) {
  try {
    return app.findFirstRecordByFilter(collection, filter, params || {});
  } catch (_) {
    return null;
  }
}

/**
 * Занят ли адрес. Занимают: любая карточка с таким адресом и любая открытая
 * ревизия НОВОЙ карточки (черновик тоже — адрес закрепляется на черновике).
 * Ревизии-правки адрес не меняют, их держит сама карточка.
 */
function slugTaken(app, kind, category, slug, exceptRevisionId) {
  const cat = kind === 'venue' ? '' : category || '';
  const card =
    kind === 'venue'
      ? findOne(app, 'venues', 'citySlug = "moskva" && slug = {:slug}', { slug })
      : findOne(app, 'specialists', 'categorySlug = {:cat} && slug = {:slug}', { cat, slug });
  if (card) return true;
  const rev = findOne(
    app,
    'revisions',
    `kind = {:kind} && categorySlug = {:cat} && slug = {:slug} && venue = "" && specialist = "" && id != {:except} && ${OPEN_FILTER}`,
    { kind, cat, slug, except: exceptRevisionId || '' }
  );
  return !!rev;
}

/** свободный вариант адреса: ivan-foto → ivan-foto-2 → … */
function suggestSlug(app, kind, category, base, exceptRevisionId) {
  if (!slugTaken(app, kind, category, base, exceptRevisionId)) return base;
  for (let i = 2; i < 100; i++) {
    const s = `${base}-${i}`;
    if (!slugTaken(app, kind, category, s, exceptRevisionId)) return s;
  }
  return '';
}

// ---------- общее ----------
function jsonOf(record, key) {
  try {
    const raw = record.getString(key);
    const v = raw ? JSON.parse(raw) : null;
    return v && typeof v === 'object' ? v : {};
  } catch (_) {
    return {};
  }
}

function str(v, max) {
  return String(v == null ? '' : v).trim().slice(0, max || 10000);
}
function int(v) {
  const n = parseInt(String(v == null ? '' : v).replace(/\s/g, ''), 10);
  return isFinite(n) && n >= 0 ? n : null;
}

/** запрос несёт только разрешённые поля; модификаторы файлов (photos+, photos-) — тоже по имени поля */
function denyExtra(body, allowed) {
  for (const key of Object.keys(body || {})) {
    const field = key.replace(/^\+|[+-]$/g, '');
    if (allowed.indexOf(field) === -1) throw new BadRequestError(`Поле «${field}» нельзя менять из кабинета.`);
  }
}

function photosOf(record) {
  return record.getStringSlice('photos').filter((n) => !!n);
}

function telegram(text) {
  const token = $os.getenv('TG_BOT_TOKEN');
  const chat = $os.getenv('TG_CHAT_ID');
  if (!token || !chat) return;
  try {
    $http.send({
      url: `https://api.telegram.org/bot${token}/sendMessage`,
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
      timeout: 5,
    });
  } catch (err) {
    $app.logger().warn('cabinet: telegram не ответил', 'error', String(err));
  }
}

function mailVendor(app, vendorId, subject, html) {
  try {
    const vendor = app.findRecordById('vendors', vendorId);
    const meta = app.settings().meta;
    const message = new MailerMessage({
      from: { address: meta.senderAddress, name: meta.senderName || meta.appName },
      to: [{ address: vendor.email() }],
      subject,
      html,
    });
    app.newMailClient().send(message);
  } catch (err) {
    // письмо — уведомление, а не часть действия: модерация не должна
    // падать из-за того, что не настроен SMTP
    app.logger().warn('cabinet: письмо подрядчику не ушло', 'vendor', vendorId, 'error', String(err));
  }
}

// ---------- отправка на модерацию ----------
/** что мешает отправить ревизию на проверку; пустой список — можно */
function submitProblems(rev) {
  const data = jsonOf(rev, 'data');
  const kind = rev.getString('kind');
  const problems = [];
  if (!str(data.name)) problems.push(kind === 'venue' ? 'укажите название площадки' : 'укажите имя или название');
  if (!rev.getString('slug')) problems.push('выберите адрес страницы');
  if (kind === 'specialist' && !rev.getString('categorySlug')) problems.push('выберите категорию');
  const photos = photosOf(rev).length;
  if (photos < MIN_PHOTOS) problems.push(`загрузите не меньше ${MIN_PHOTOS} фото (сейчас ${photos})`);
  if (str(data.about).length < MIN_ABOUT) problems.push(`расскажите о себе подробнее — от ${MIN_ABOUT} знаков`);
  const contacts = data.contacts && typeof data.contacts === 'object' ? data.contacts : {};
  if (!str(contacts.phone)) problems.push('укажите телефон в блоке «Контакты» — клиент откроет его кнопкой');
  const hit = findContact(data, '');
  if (hit) {
    problems.push(
      `в поле «${fieldLabel(hit.path)}» есть ${hit.what} — контакты пишутся только в блоке «Контакты»`
    );
  }
  return problems;
}

/** правку можно одобрить, только если карточка не изменилась после её начала */
function staleProblem(app, rev) {
  const kind = rev.getString('kind');
  const cardId = rev.getString(cardField(kind));
  if (!cardId) return '';
  const card = app.findRecordById(cardCollection(kind), cardId);
  if (card.getInt('version') === rev.getInt('baseVersion')) return '';
  return (
    `Карточка уже изменилась после начала этой правки (сейчас версия ${card.getInt('version')}, ` +
    `правка начата с версии ${rev.getInt('baseVersion')}).`
  );
}

// ---------- запросы подрядчика ----------
const REVISION_CREATE_FIELDS = ['owner', 'kind', 'categorySlug', 'slug', 'data', 'photos', 'avatar', 'cover', 'status'];
const REVISION_EDIT_FIELDS = ['data', 'photos', 'avatar', 'cover', 'status'];

function vendorCreateRevision(e) {
  denyExtra(e.requestInfo().body, REVISION_CREATE_FIELDS);
  const r = e.record;
  // новая карточка начинается черновиком: на проверку уходит отдельным
  // действием, когда фото уже загружены
  const status = r.getString('status') || 'draft';
  if (status !== 'draft') throw new BadRequestError('Новая карточка создаётся черновиком.');
  r.set('status', 'draft');
  if (r.getString('kind') === 'venue') r.set('categorySlug', '');
  r.set('venue', '');
  r.set('specialist', '');
  r.set('baseVersion', 0);
  const slug = r.getString('slug');
  if (slug && slugTaken(e.app, r.getString('kind'), r.getString('categorySlug'), slug, '')) {
    throw new BadRequestError(`Адрес «${slug}» уже занят — выберите другое название.`);
  }
  return e.next();
}

function vendorUpdateRevision(e) {
  const body = e.requestInfo().body;
  const r = e.record;
  const orig = r.original();
  const from = orig.getString('status');
  const to = r.getString('status');

  if (from === 'approved') {
    throw new BadRequestError('Эта версия уже опубликована. Чтобы внести правку, откройте карточку в кабинете заново.');
  }
  if (from === 'review') {
    // на проверке менять нечего, можно только отозвать
    const onlyStatus = Object.keys(body).every((k) => k === 'status');
    if (to !== 'draft' || !onlyStatus) {
      throw new BadRequestError('Карточка на проверке. Изменить её можно после ответа модератора — или отзовите её.');
    }
    return e.next();
  }

  const isNewCard = !orig.getString('venue') && !orig.getString('specialist');
  denyExtra(body, isNewCard ? REVISION_EDIT_FIELDS.concat(['kind', 'categorySlug', 'slug']) : REVISION_EDIT_FIELDS);
  if (to !== 'draft' && to !== 'review' && to !== from) {
    throw new BadRequestError('Из кабинета карточку можно сохранить черновиком или отправить на проверку.');
  }

  if (isNewCard) {
    if (r.getString('kind') === 'venue') r.set('categorySlug', '');
    const slugChanged =
      r.getString('slug') !== orig.getString('slug') ||
      r.getString('categorySlug') !== orig.getString('categorySlug') ||
      r.getString('kind') !== orig.getString('kind');
    if (slugChanged && r.getString('slug') && slugTaken(e.app, r.getString('kind'), r.getString('categorySlug'), r.getString('slug'), r.id)) {
      throw new BadRequestError(`Адрес «${r.getString('slug')}» уже занят — выберите другое название.`);
    }
  }

  const submitting = to === 'review';
  if (submitting) {
    const problems = submitProblems(r);
    const stale = staleProblem(e.app, r);
    if (stale) problems.push(stale + ' Начните правку заново из карточки.');
    if (problems.length) throw new BadRequestError('Не получилось отправить на проверку: ' + problems.join('; ') + '.');
    r.set('submittedAt', new DateTime());
  }

  e.next();

  if (submitting) {
    const data = jsonOf(r, 'data');
    telegram(`На проверку: ${str(data.name, 120)} (${r.getString('kind') === 'venue' ? 'площадка' : r.getString('categorySlug')})` +
      `${isNewCard ? ', новая карточка' : ', правка'}\n${SITE_URL}/_/#/collections?collection=revisions&recordId=${r.id}`);
    mailVendor(e.app, r.getString('owner'), 'Карточка отправлена на проверку — WED Secrets',
      `<p>Получили вашу карточку «${str(data.name, 120)}» и проверим её в ближайшее время.</p>` +
      `<p>Когда она появится на сайте, пришлём письмо со ссылкой.</p>`);
  }
}

// ---------- модерация ----------
function moderateRevision(e) {
  const r = e.record;
  const from = r.original().getString('status');
  const to = r.getString('status');
  if (from === to) return e.next();

  if (to === 'approved') {
    if (from !== 'review') throw new BadRequestError('Одобрить можно только карточку на проверке.');
    // карточка и ревизия сохраняются одной транзакцией: упало одно —
    // не сохранилось ничего, и повторное одобрение не споткнётся о версию.
    // Письмо — уже после, через основной app: транзакционный к этому
    // моменту закрыт, и письмо через него молча не ушло бы.
    const app = e.app;
    app.runInTransaction((txApp) => {
      approve(txApp, r);
      e.app = txApp;
      e.next();
    });
    e.app = app;
    const data = jsonOf(r, 'data');
    const kind = r.getString('kind');
    const url = cardUrl(kind, r.getString('categorySlug'), r.getString('slug'));
    mailVendor(app, r.getString('owner'), 'Карточка опубликована — WED Secrets',
      `<p>Карточка «${str(data.name, 120)}» опубликована: <a href="${url}">${url}</a>.</p>` +
      `<p>Теперь в кабинете можно добавить видео — пришлите ссылку на Яндекс.Диск, ролики мы обработаем сами.</p>`);
    return;
  }

  if (to === 'rejected') {
    if (from !== 'review') throw new BadRequestError('Вернуть можно только карточку на проверке.');
    const reason = str(r.getString('rejectReason'));
    if (!reason) throw new BadRequestError('Напишите причину в поле rejectReason — без неё подрядчик не поймёт, что исправить.');
    r.set('reviewedAt', new DateTime());
    e.next();
    const data = jsonOf(r, 'data');
    mailVendor(e.app, r.getString('owner'), 'Карточку нужно поправить — WED Secrets',
      `<p>Мы посмотрели карточку «${str(data.name, 120)}» и вернули её на доработку.</p>` +
      `<p><strong>Что исправить:</strong> ${reason.replace(/</g, '&lt;')}</p>` +
      `<p>Поправьте в кабинете и отправьте на проверку снова.</p>`);
    return;
  }

  return e.next();
}

/** перенос одобренной ревизии в карточку сайта */
function approve(app, rev) {
  const kind = rev.getString('kind');
  const relField = cardField(kind);
  const collection = app.findCollectionByNameOrId(cardCollection(kind));
  const data = jsonOf(rev, 'data');
  let card;
  if (rev.getString(relField)) {
    card = app.findRecordById(collection, rev.getString(relField));
    const stale = staleProblem(app, rev);
    if (stale) throw new BadRequestError(stale + ' Верните правку подрядчику: пусть откроет карточку заново.');
  } else {
    if (slugTaken(app, kind, rev.getString('categorySlug'), rev.getString('slug'), rev.id)) {
      throw new BadRequestError(`Адрес «${rev.getString('slug')}» уже занят — поменяйте slug в ревизии.`);
    }
    card = new Record(collection);
    card.set('slug', rev.getString('slug'));
    card.set('citySlug', 'moskva');
    if (kind === 'specialist') card.set('categorySlug', rev.getString('categorySlug'));
    card.set('owner', rev.getString('owner'));
    card.set('version', 0);
  }

  applyData(kind, card, data);
  card.set('status', 'published');
  card.set('version', card.getInt('version') + 1);
  card.set('form', data);
  card.set('contacts', data.contacts && typeof data.contacts === 'object' ? data.contacts : {});
  card.set('source', 'кабинет');

  // Файлы копируются из ревизии в карточку (у ревизии они закрыты, у
  // карточки — открыты). Набор ревизии полный, поэтому он заменяет набор
  // карточки целиком; старые файлы карточки PocketBase удалит сам.
  const names = photosOf(rev);
  const fsys = app.newFilesystem();
  try {
    const base = rev.baseFilesPath() + '/';
    card.set('photos', names.map((n) => fsys.getReuploadableFile(base + n, false)));
    if (kind === 'specialist') {
      const avatar = rev.getString('avatar');
      card.set('avatar', avatar ? fsys.getReuploadableFile(base + avatar, false) : null);
    }
    app.save(card);
  } finally {
    fsys.close();
  }

  // page собирается после сохранения: имена файлов карточки известны
  // только теперь (PocketBase дописывает к ним случайный суффикс)
  const saved = photosOf(card);
  const coverIndex = Math.max(0, names.indexOf(rev.getString('cover')));
  card.set('page', buildPage(kind, card, data, saved, coverIndex));
  app.save(card);

  rev.set(relField, card.id);
  rev.set('reviewedAt', new DateTime());
  rev.set('rejectReason', '');
}

/** плоские колонки карточки — по ним фильтрует каталог */
function applyData(kind, card, data) {
  card.set('name', str(data.name, 120));
  const filters = data.filters && typeof data.filters === 'object' ? data.filters : {};
  if (kind === 'specialist') {
    card.set('tagline', str(data.tagline, 200));
    card.set('priceFrom', int(data.priceFrom));
    card.set('filters', filters);
    return;
  }
  card.set('address', str(data.address, 300));
  for (const key of ['capacityBanquet', 'capacityBuffet', 'checkFrom', 'rentFrom']) card.set(key, int(data[key]));
  // select-поля карточки принимают только свои значения: лишнее отбрасываем,
  // а не роняем одобрение
  const allowed = (name) => card.collection().fields.getByName(name).values;
  const pick = (name, v) => [].concat(v || []).map(String).filter((x) => allowed(name).indexOf(x) !== -1);
  const type = pick('type', filters.type)[0];
  card.set('type', type || '');
  for (const key of ['districts', 'purposes', 'features']) card.set(key, pick(key, filters[key]));
}

/**
 * Тело страницы карточки из кабинета. Форма отличается от JSON конвейера
 * venue-page / specialist-page (source: 'cabinet'): такие карточки рисует
 * сервер прямо из базы (CABINET.md, раздел 11), в src/ их не выгружаем.
 */
function buildPage(kind, card, data, photos, coverIndex) {
  const common = {
    source: 'cabinet',
    slug: card.getString('slug'),
    name: str(data.name, 120),
    about: str(data.about, 20000),
    priceFrom: int(data.priceFrom),
    priceNote: str(data.priceNote, 300),
    filters: data.filters && typeof data.filters === 'object' ? data.filters : {},
    photos,
    cover: coverIndex,
    version: card.getInt('version'),
  };
  if (kind === 'specialist') {
    common.categorySlug = card.getString('categorySlug');
    common.tagline = str(data.tagline, 200);
    common.avatar = card.getString('avatar');
    return common;
  }
  common.address = str(data.address, 300);
  common.halls = Array.isArray(data.halls) ? data.halls : [];
  for (const key of ['capacityBanquet', 'capacityBuffet', 'checkFrom', 'rentFrom']) common[key] = int(data[key]);
  return common;
}

// ---------- маршруты /api/wed ----------
/**
 * Начать правку опубликованной карточки: ревизия-черновик с текущими
 * ответами и фото карточки. Открытая правка у карточки одна — повторный
 * вызов возвращает её же, а не плодит параллельные версии.
 */
function startEdit(e) {
  const body = e.requestInfo().body;
  const kind = body.kind === 'venue' ? 'venue' : 'specialist';
  const relField = cardField(kind);
  let card;
  try {
    card = e.app.findRecordById(cardCollection(kind), String(body.card || ''));
  } catch (_) {
    throw new NotFoundError('Карточка не найдена.');
  }
  if (card.getString('owner') !== e.auth.id) throw new ForbiddenError('Это не ваша карточка.');

  const open = findOne(e.app, 'revisions', `${relField} = {:card} && ${OPEN_FILTER}`, { card: card.id });
  if (open) return e.json(200, open);

  const rev = new Record(e.app.findCollectionByNameOrId('revisions'));
  rev.set('owner', e.auth.id);
  rev.set('kind', kind);
  rev.set('categorySlug', kind === 'venue' ? '' : card.getString('categorySlug'));
  rev.set('slug', card.getString('slug'));
  rev.set(relField, card.id);
  rev.set('status', 'draft');
  rev.set('data', jsonOf(card, 'form'));
  rev.set('baseVersion', card.getInt('version'));

  const fsys = e.app.newFilesystem();
  try {
    const base = card.baseFilesPath() + '/';
    const photos = photosOf(card);
    rev.set('photos', photos.slice(0, 30).map((n) => fsys.getReuploadableFile(base + n, false)));
    if (kind === 'specialist' && card.getString('avatar')) {
      rev.set('avatar', fsys.getReuploadableFile(base + card.getString('avatar'), false));
    }
    e.app.save(rev);
  } finally {
    fsys.close();
  }
  const page = jsonOf(card, 'page');
  const cover = photosOf(rev)[page.cover || 0];
  if (cover) {
    rev.set('cover', cover);
    e.app.save(rev);
  }
  return e.json(200, rev);
}

/** GET /api/wed/slug?kind=&category=&name=|slug=&except= — свободен ли адрес */
function checkSlug(e) {
  const q = e.requestInfo().query;
  const kind = q.kind === 'venue' ? 'venue' : 'specialist';
  const category = kind === 'venue' ? '' : slugify(q.category);
  const slug = slugify(q.slug || q.name);
  if (!slug || slug.length < 2) return e.json(200, { slug: '', free: false, suggestion: '' });
  const free = !slugTaken(e.app, kind, category, slug, q.except || '');
  return e.json(200, { slug, free, suggestion: free ? slug : suggestSlug(e.app, kind, category, slug, q.except || '') });
}

// ---------- видео ----------
const VIDEO_HOSTS = /^(?:disk\.yandex\.(?:ru|com)|disk\.360\.yandex\.ru|yadi\.sk|cloud\.mail\.ru)$/i;
const MAX_OPEN_VIDEO_REQUESTS = 3;

function vendorCreateVideoRequest(e) {
  denyExtra(e.requestInfo().body, ['owner', 'venue', 'specialist', 'url', 'comment']);
  const r = e.record;
  r.set('status', 'new');
  r.set('reason', '');
  const venueId = r.getString('venue');
  const specialistId = r.getString('specialist');
  if (!!venueId === !!specialistId) throw new BadRequestError('Укажите одну карточку, к которой добавить видео.');
  let card;
  try {
    card = e.app.findRecordById(venueId ? 'venues' : 'specialists', venueId || specialistId);
  } catch (_) {
    throw new BadRequestError('Карточка не найдена.');
  }
  if (card.getString('owner') !== e.auth.id || card.getString('status') !== 'published') {
    throw new BadRequestError('Видео добавляется к вашей опубликованной карточке — после первой модерации.');
  }
  const open = e.app.findRecordsByFilter(
    'video_requests', 'owner = {:owner} && (status = "new" || status = "in-progress")', '', MAX_OPEN_VIDEO_REQUESTS, 0, { owner: e.auth.id }
  );
  if (open.length >= MAX_OPEN_VIDEO_REQUESTS) {
    throw new BadRequestError('Предыдущие ссылки ещё в работе — дождитесь, пока мы их обработаем.');
  }

  const url = r.getString('url');
  const host = (url.match(/^https?:\/\/([^/?#:]+)/i) || [])[1] || '';
  if (!VIDEO_HOSTS.test(host)) throw new BadRequestError('Пришлите ссылку на Яндекс.Диск или Облако Mail.ru.');
  // Закрытую папку ловим сразу, а не через день, когда мы до неё дойдём.
  // Публичный API Диска отвечает 404 на закрытую или удалённую ссылку.
  // Сеть недоступна — не мешаем: проверим руками при обработке.
  if (/yandex|yadi\.sk/i.test(host)) {
    try {
      const res = $http.send({
        url: 'https://cloud-api.yandex.net/v1/disk/public/resources?limit=0&public_key=' + encodeURIComponent(url),
        timeout: 8,
      });
      if (res.statusCode === 404) {
        throw new BadRequestError('Ссылка не открывается. На Диске включите доступ «Все, у кого есть ссылка» и пришлите её снова.');
      }
    } catch (err) {
      if (err instanceof BadRequestError) throw err;
    }
  }

  e.next();
  telegram(`Видео: ${card.getString('name')} — ${url}${r.getString('comment') ? '\n' + r.getString('comment') : ''}`);
}

// ---------- учётки ----------
function vendorCreateAccount(e) {
  denyExtra(e.requestInfo().body, ['email', 'password', 'passwordConfirm', 'name', 'phone', 'kind', 'emailVisibility']);
  return e.next();
}
function vendorUpdateAccount(e) {
  denyExtra(e.requestInfo().body, ['name', 'phone']);
  return e.next();
}

module.exports = {
  MIN_PHOTOS,
  findContact,
  slugify,
  vendorCreateRevision,
  vendorUpdateRevision,
  moderateRevision,
  startEdit,
  checkSlug,
  vendorCreateVideoRequest,
  vendorCreateAccount,
  vendorUpdateAccount,
};
