/// <reference path="../../pb_data/types.d.ts" />
// ============================================================
// ЛОГИКА КАБИНЕТА ПОДРЯДЧИКА — общая для хуков cabinet.pb.js.
//
// Обработчики pb_hooks исполняются каждый в своей изолированной VM:
// функции верхнего уровня *.pb.js внутри обработчика не видны. Поэтому
// всё общее живёт здесь, а обработчик подключает модуль через require().
//
// Кто что может (подробно — docs/cabinet/CABINET.md):
//   подрядчик  — только свои ревизии, только белый список полей,
//                статусы draft ⇄ review; карточки сайта не трогает вовсе
//   модератор  — review → approved | rejected; approved переносит
//                ревизию в карточку (venues / specialists) одной транзакцией
// ============================================================

/** фото на карточке, без которых её нет смысла показывать в каталоге */
const MIN_PHOTOS = 8;
/** «о себе» короче этого — визитка выйдет пустой (docs/cabinet/CABINET.md, 11.4) */
const MIN_ABOUT = 150;
/** цена выше — опечатка (прогон 26.10: прошло 3 000 000 000 000 ₽) */
const MAX_PRICE = 50000000;
/** фото на карточку (решение 16.10) */
const MAX_PHOTOS = 50;
/** карточек на одну учётку, включая новые на проверке (решение 16.10) */
const MAX_CARDS = 3;
/** ссылок на видео в карточке (cabinet-form.ts, MAX_VIDEOS) */
const MAX_VIDEOS = 5;
/** ревизия ещё не закрыта модератором */
const OPEN_FILTER = '(status = "draft" || status = "review" || status = "rejected")';
const SITE_URL = ($os.getenv('SITE_URL') || 'https://wed-secrets.ru').replace(/\/$/, '');

// ---------- контакты в тексте ----------
// Контакты живут только в блоке «Контакты» — клиент открывает их кнопкой
// (docs/cabinet/CABINET.md, раздел 8). Телефон или ник в «О себе» обходит эту кнопку.
// Проверяем при отправке на модерацию, а не при каждом автосохранении:
// автосохранение, которое отказывается сохранять, теряет набранный текст.
const CONTACT_PATTERNS = [
  // +7 916 123-45-67, 8 (916) 123 45 67; «2018» и «150 000 – 300 000» не ловит:
  // нужна 7 или 8 в начале числа и группы 3-3-2-2
  { re: /(?:\+7|\b[78])[\s\-()]*\d{3}[\s\-()]*\d{3}[\s\-]*\d{2}[\s\-]*\d{2}(?!\d)/, what: 'указан номер телефона' },
  { re: /\b9\d{2}[\s\-()]*\d{3}[\s\-]*\d{2}[\s\-]*\d{2}(?!\d)/, what: 'указан номер телефона' },
  { re: /[\w.+-]+@[\w-]+\.[a-zа-я]{2,}/i, what: 'указана почта' },
  { re: /https?:\/\/|www\./i, what: 'указана ссылка' },
  { re: /\b(?:t\.me|wa\.me|vk\.com|vk\.cc|taplink\.cc|instagram\.com|youtu\.be|youtube\.com)\b/i, what: 'указана ссылка' },
  { re: /\b[a-z0-9-]{2,}\.(?:ru|com|net|org|su|pro|me|io|art|online|site|studio|photo|moscow|space)\b/i, what: 'указан адрес сайта' },
  { re: /[а-яё0-9-]{2,}\.рф/i, what: 'указан адрес сайта' },
  { re: /(?:^|[\s(«"])@[a-z0-9_.]{3,}/i, what: 'указан ник в мессенджере' },
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
      // контакты и ссылки на видео — ссылки по назначению
      if (k === 'contacts' || k === 'videos') continue;
      const hit = findContact(value[k], path ? path + '.' + k : k);
      if (hit) return hit;
    }
  }
  return null;
}

/** как поле шаблона называется у подрядчика в форме */
const FIELD_LABELS = {
  name: 'Название', tagline: 'Строка под именем', about: 'О себе', intro: 'Коротко о себе', priceNote: 'Про цену',
  address: 'Адрес', halls: 'Залы', filters: 'Ответы на вопросы', sections: 'Описание',
  tariffs: 'Прайс', terms: 'Условия',
};

// ---------- текст карточки ----------
// В анкете текст пишут разделами, как в мессенджере (docs/cabinet/CABINET-UX.md §2 п.6):
// заголовок + тело; строки с «—», «-», «•» — список, пустая строка — новый
// абзац. Храним как написано ({ title, body }) — правка открывается тем же
// текстом; в разделы визитки (StorySection) разбираем при публикации.
const BULLET = /^\s*[—–\-•·*]\s+/;
// крупная фраза (Никита 05.11, стиль «Aa» в «Описании»): абзац с «> » в начале.
// Редактор ставит её первой в разделе — на визитке это lead (StoryText)
const LEAD = /^\s*>\s*/;

function sectionsOf(data) {
  return (Array.isArray(data.sections) ? data.sections : [])
    .map((x) => ({ title: str(x && x.title, 200), body: str(x && x.body, 20000) }))
    // раздел из шаблона без текста — только заголовок: на визитку не идёт
    .filter((x) => !!x.body);
}

/** длина текста карточки: разделы анкеты, у старых правок — «О себе» */
function textLength(data) {
  const fromSections = sectionsOf(data).reduce((n, x) => n + x.body.replace(/\s+/g, ' ').length, 0);
  return Math.max(fromSections, str(data.about).length);
}

/** «ыыыыыы…» без пробелов — не текст: в длинном тексте должны быть слова */
function looksLikeText(data) {
  const all = sectionsOf(data).map((x) => x.body).join(' ') + ' ' + str(data.about);
  const words = all.split(/\s+/).filter((w) => w.length >= 2);
  return words.length >= 20;
}

/**
 * Смайлики в описании (Никита 06.11): форма их не пропускает (lib/notes-editor.ts),
 * но запрос можно собрать и в обход формы — проверка дублируется здесь.
 * Не \p{Extended_Pictographic}: в goja свойства Юникода в регулярках
 * ненадёжны — идём по кодовым точкам. © ® ™ — не смайлики, лежат вне диапазонов.
 */
function isEmoji(c) {
  return (c >= 0x1f000 && c <= 0x1faff) // смайлы, люди, флаги, транспорт, символы
    || (c >= 0x2600 && c <= 0x27bf)     // ☀ ☺ ♥ ✨ ✅ ✈ — разные символы и дингбаты
    || (c >= 0x2b05 && c <= 0x2b55)     // ⬆ ⬛ ⭐ ⭕
    || c === 0x231a || c === 0x231b || (c >= 0x23e9 && c <= 0x23fa) // ⌚ ⏰ ⏳
    || c === 0x200d || c === 0xfe0f      // склейка и «покажи картинкой»
    || c === 0x3030 || c === 0x303d || c === 0x3297 || c === 0x3299;
}

function hasEmoji(text) {
  for (const ch of String(text || '')) if (isEmoji(ch.codePointAt(0))) return true;
  return false;
}

/** смайлики в тексте карточки: разделы «Описания» с заголовками и старое «О себе» */
function emojiInText(data) {
  return sectionsOf(data).some((x) => hasEmoji(x.title) || hasEmoji(x.body)) || hasEmoji(data.about);
}

/** тело раздела → StorySection: абзацы до списка — text, список — list, после — after */
function parseSection(sec) {
  const out = { text: [], list: [], after: [] };
  if (sec.title) out.title = sec.title;
  for (const para of sec.body.split(/\n\s*\n/)) {
    // крупная фраза — только первым абзацем раздела; в другом месте это обычный текст
    if (LEAD.test(para) && !out.lead && !out.text.length && !out.list.length) {
      out.lead = para.replace(LEAD, '').replace(/\s+/g, ' ').trim();
      continue;
    }
    const lines = para.split('\n').map((l) => l.replace(LEAD, '').trim()).filter((l) => !!l);
    // подводка «Что входит:» в одном абзаце со списком — до списка, а не после
    // (прогон 27.10): место строки решает, начался ли список к ней
    let plain = [];
    const flush = () => { if (plain.length) (out.list.length ? out.after : out.text).push(plain.join(' ')); plain = []; };
    for (const line of lines) {
      if (BULLET.test(line)) { flush(); out.list.push(line.replace(BULLET, '')); }
      else plain.push(line);
    }
    flush();
  }
  for (const k of ['text', 'list', 'after']) if (!out[k].length) delete out[k];
  return out;
}

/** тарифы: { name, price, unit, includes } — unit «за что» («за 8 часов»), includes строками */
function tariffsOf(data) {
  return (Array.isArray(data.tariffs) ? data.tariffs : [])
    .map((t) => ({
      name: str(t && t.name, 120),
      price: int(t && t.price),
      unit: str(t && t.unit, 60),
      includes: str(t && t.includes, 4000).split('\n').map((l) => l.replace(BULLET, '').trim()).filter((l) => !!l),
    }))
    .filter((t) => t.name || t.price);
}

/** «цена от» — самый дешёвый пакет; пакетов нет — что указано руками */
function priceFromOf(data) {
  const prices = tariffsOf(data).map((t) => t.price).filter((p) => p !== null && p > 0);
  return prices.length ? Math.min.apply(null, prices) : int(data.priceFrom);
}
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

/** модератор — учётка moderators или суперпользователь */
function isModerator(e) {
  if (e.hasSuperuserAuth()) return true;
  return !!e.auth && e.auth.collection().name === 'moderators';
}

/** потолок фото ревизии: 50, а у карточек, заведённых нами, — сколько уже на карточке */
function photoCap(app, r) {
  // у карточек, заведённых нами, кадров бывает больше 50 (Гребнево — 102):
  // правка их не режет
  let cap = MAX_PHOTOS;
  const kind = r.getString('kind');
  const cardId = r.getString(cardField(kind));
  if (cardId) {
    const card = findOne(app, cardCollection(kind), 'id = {:id}', { id: cardId });
    if (card) cap = Math.max(cap, photosOf(card).length);
  }
  return cap;
}

function photoLimit(app, r) {
  // в обработчике запроса новые файлы ещё не сохранены: в значении поля
  // их нет, они лежат отдельно до сохранения записи
  const n = photosOf(r).length + r.getUnsavedFiles('photos').length;
  const cap = photoCap(app, r);
  if (n > cap) throw new BadRequestError(`На карточке до ${cap} фото, сейчас ${n} — уберите лишние.`);
}

/** сколько карточек у учётки: свои опубликованные + новые, ещё не закрытые модератором */
function cardCount(app, vendorId) {
  let n = 0;
  for (const c of ['venues', 'specialists']) {
    n += app.findRecordsByFilter(c, 'owner = {:v}', '', 0, 0, { v: vendorId }).length;
  }
  n += app.findRecordsByFilter('revisions', `owner = {:v} && venue = "" && specialist = "" && ${OPEN_FILTER}`, '', 0, 0, { v: vendorId }).length;
  return n;
}

/**
 * Админское уведомление (карточка на проверку, ссылка на видео, заявка пары) —
 * в группу модераторов Telegram (TG_CHAT_ID) и в такой же чат MAX (MAX_CHAT_ID,
 * бот добавлен в чат; решение Никиты 05.11). Каждый канал — сам по себе:
 * не настроен или не ответил — второй всё равно получает.
 */
function telegram(text) {
  const maxChat = $os.getenv('MAX_CHAT_ID');
  if (maxChat) require(`${__hooks}/lib/max.js`).sendChat(maxChat, text);
  const token = $os.getenv('TG_BOT_TOKEN');
  const chat = $os.getenv('TG_CHAT_ID');
  if (!token || !chat) return;
  try {
    const res = $http.send({
      url: `https://api.telegram.org/bot${token}/sendMessage`,
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text, link_preview_options: { is_disabled: true } }),
      timeout: 5,
    });
    // отказ Telegram (не тот чат, бот не в группе) раньше проходил молча —
    // прогон 26.10: уведомление не пришло, а в логах пусто
    if (res.statusCode !== 200) {
      $app.logger().warn('cabinet: telegram отказал', 'status', res.statusCode, 'body', toString(res.body).slice(0, 500));
    }
  } catch (err) {
    $app.logger().warn('cabinet: telegram не ответил', 'error', String(err));
  }
}

/**
 * Письмо нам самим (ящик отправителя из настроек почты, kabinet@wed-secrets.ru) —
 * копия того, что ушло в группу модерации: заявка не теряется, если Telegram
 * недоступен (Никита, 02.11). Без настроенной почты — молча пропускаем.
 */
function mailUs(subject, text) {
  const s = $app.settings();
  const to = s.meta.senderAddress;
  if (!s.smtp.enabled || !to) return;
  try {
    const esc = (v) => String(v).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
    $app.newMailClient().send(new MailerMessage({
      from: { address: to, name: s.meta.senderName || 'WED Secrets' },
      to: [{ address: to }],
      subject,
      html: '<p>' + esc(text).replace(/\n/g, '<br>') + '</p>',
    }));
  } catch (err) {
    $app.logger().warn('cabinet: письмо нам не ушло', 'error', String(err));
  }
}

/**
 * Выкладка сайта сразу после решения по карточке из кабинета (27.10):
 * пока страницы собирает сборка, а не сервер из базы, одобренная карточка
 * ждала бы следующего пуша. Запускает Deploy в GitHub Actions — тот же
 * pb-pull-cabinet + сборка. Частые решения не копятся: у деплоя
 * concurrency с отменой, последний запуск забирает всё.
 * Окружение: GH_DEPLOY_TOKEN — fine-grained токен только на этот репозиторий,
 * право Actions: read and write; GH_REPO — «владелец/репозиторий».
 * Без токена молчит: локально и в тестах ничего не выкладывается.
 */
function deploySite(why) {
  const token = $os.getenv('GH_DEPLOY_TOKEN');
  if (!token) return;
  // одобрение сохраняет карточку дважды — один запуск на решение. Второе
  // решение в те же 10 с не теряется: деплой забирает базу (pb-pull-cabinet)
  // позже, после установки зависимостей
  const now = Date.now();
  if (now - ($app.store().get('wedDeployAt') || 0) < 10000) return;
  $app.store().set('wedDeployAt', now);
  const repo = $os.getenv('GH_REPO') || 'Nikitaa2333333/wedwibse';
  try {
    const res = $http.send({
      url: `https://api.github.com/repos/${repo}/actions/workflows/deploy.yml/dispatches`,
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'content-type': 'application/json',
        'user-agent': 'wedsecrets-pb',
      },
      body: JSON.stringify({ ref: 'master' }),
      timeout: 10,
    });
    if (res.statusCode !== 204) {
      $app.logger().warn('cabinet: выкладка не запустилась', 'why', why, 'status', res.statusCode, 'body', toString(res.body).slice(0, 500));
    } else {
      $app.logger().info('cabinet: выкладка запущена', 'why', why);
    }
  } catch (err) {
    $app.logger().warn('cabinet: GitHub не ответил', 'why', why, 'error', String(err));
  }
}

/** карточка из кабинета сохранена (одобрение, снятие, правка в админке базы) — на сайт */
// САЙТ ИЗ БАЗЫ, этап 2 (05.11.2026): раздел подрядчиков целиком рисует
// сервер из живых данных (src/lib/live-data.ts) — каталоги, визитки,
// «Похожие», карта раздела. Карточка из кабинета и правки владельцев видны
// через секунды, ПЕРЕСБОРКА САЙТА НЕ НУЖНА. Хук больше ничего не запускает;
// deploySite остаётся для площадок из кабинета (этап 3).
function cardSaved(e) {
  e.next();
  queuePhotos(e.record);
}

/**
 * СЕРВИС ФОТО (07.11.2026, docs/PHOTO-SERVICE.md): кадры записи — в очередь
 * нарезки. Обработчик (scripts/photo-worker.mjs, служба wedsecrets-photo)
 * режет все ширины заранее, чтобы первый посетитель не ждал ни одного кадра.
 * Вызывается по «Готово» (кадры ревизии) и при сохранении карточки
 * (одобрение, pb-seed --publish). Уже нарезанное обработчик пропускает сам,
 * поэтому лишний вызов ничего не стоит. Без PHOTO_QUEUE (локально, тесты)
 * молчит; сбой записи очереди не ломает запрос — обход обработчика раз
 * в 10 минут дорежет пропущенное.
 */
function queuePhotos(record) {
  const dir = $os.getenv('PHOTO_QUEUE');
  if (!dir) return;
  try {
    const names = photosOf(record).slice();
    const avatar = record.getString('avatar');
    if (avatar) names.push(avatar);
    if (!names.length) return;
    const base = `${record.collection().id}/${record.id}/`;
    $os.writeFile(`${dir}/${Date.now()}-${record.id}.txt`, names.map((n) => base + n).join('\n'), 0o644);
  } catch (err) {
    $app.logger().warn('cabinet: очередь нарезки фото не записалась', 'record', record.id, 'error', String(err));
  }
}

/**
 * Куда писать подрядчику (правило Никиты 05.11: через какой мессенджер вошёл,
 * туда и уведомления; выключается тумблером в профиле — vendors.notify).
 * Настройки не трогали — включены все подключённые мессенджеры.
 */
function vendorChannels(vendor) {
  let n = null;
  try { n = JSON.parse(vendor.getString('notify') || 'null'); } catch (_) {}
  const set = n && typeof n === 'object' && Object.keys(n).length > 0;
  return {
    telegram: !!vendor.getString('telegramId') && (set ? n.telegram === true : true),
    max: !!vendor.getString('maxId') && (set ? n.max === true : true),
  };
}

/** личное сообщение подрядчику ботом Telegram (бот пишет, раз человек входил через него с правом писать) */
function telegramTo(chatId, text, button) {
  const token = $os.getenv('TG_BOT_TOKEN');
  if (!token || !chatId) return;
  const msg = { chat_id: chatId, text, link_preview_options: { is_disabled: true } };
  if (button) msg.reply_markup = { inline_keyboard: [[{ text: button.text, url: button.url }]] };
  try {
    const res = $http.send({
      url: `https://api.telegram.org/bot${token}/sendMessage`,
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(msg),
      timeout: 5,
    });
    if (res.statusCode !== 200) $app.logger().warn('cabinet: telegram подрядчику отказал', 'status', res.statusCode, 'body', toString(res.body).slice(0, 300));
  } catch (err) {
    $app.logger().warn('cabinet: telegram подрядчику не ответил', 'error', String(err));
  }
}

/**
 * Письмо подрядчику (07.11, вторая версия после разбора Никиты: первая —
 * узкая карточка на сером поле — на ПК тонула в пустых полях, на телефоне
 * отступала текстом на два уровня). Теперь белый лист без рамки, одна
 * колонка 560 px: марка, плашка статуса (шкала --st-* кабинета), крупное
 * имя карточки, текст, причина возврата пунктами в красной подложке без
 * жирной метки, кнопка (на телефоне во всю ширину) и адрес кабинета текстом —
 * на случай, если почта кнопку не нарисует. Стили инлайн + bgcolor (их
 * понимают все клиенты), <style> — только отступы на узком экране.
 * Марка — знак «крем», как на главной (public/logo-unicase.svg), в PNG
 * втрое плотнее показа: public/mail/logo-cream-v2.png (почта SVG не
 * показывает; новый знак — новое имя файла, nginx кэширует).
 *   status — 'ok' | 'bad' | 'info'; label — текст плашки;
 *   lines / after — абзацы до и после причины (готовый HTML);
 *   reason — текст причины, строки → пункты (экранируем здесь);
 *   logoSrc — только для пробной отправки (cid:), по умолчанию адрес сайта
 */
const MAIL_ST = {
  ok: ['#e3f6e9', '#17703a'],
  bad: ['#fde9e9', '#b3263e'],
  info: ['#e8efff', '#1f4fa8'],
};
const escHtml = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function vendorMail({ status, label, title, lines, reason, after = [], logoSrc }) {
  const [bg, fg] = MAIL_ST[status] || MAIL_ST.info;
  const ink = '#1e242e';
  const font = "font-family:Onest,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;";
  const text = `${font}font-size:17px;line-height:1.55;color:${ink};`;
  const p = (html) => `<p style="margin:0 0 14px;${text}">${html}</p>`;
  const cabinet = `${SITE_URL}/profi/moi/`;
  const points = reason
    ? String(reason).split(/\n+/).map((s) => s.trim()).filter((s) => !!s)
    : [];
  const reasonHtml = points.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 20px;"><tr>` +
      `<td bgcolor="${MAIL_ST.bad[0]}" style="background:${MAIL_ST.bad[0]};border-radius:14px;padding:16px 18px;">` +
      points.map((s, i) =>
        `<table role="presentation" cellpadding="0" cellspacing="0" style="${i ? 'margin-top:10px;' : ''}"><tr>` +
        `<td valign="top" style="padding:0 10px 0 0;${text}color:${MAIL_ST.bad[1]};">•</td>` +
        `<td valign="top" style="${text}">${escHtml(s)}</td></tr></table>`).join('') +
      `</td></tr></table>`
    : '';
  return '<!doctype html><html lang="ru"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">' +
    '<style>@media (max-width:600px){.wrap{padding:20px 20px 28px!important}.btn,.btn a{display:block!important;width:100%!important;text-align:center!important;box-sizing:border-box}.h1{font-size:24px!important}}</style>' +
    `</head><body style="margin:0;padding:0;background:#ffffff;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="background:#ffffff;"><tr><td align="center">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;"><tr><td class="wrap" align="left" style="padding:36px 24px 40px;">` +
    // марка
    `<a href="${SITE_URL}/" style="display:inline-block;"><img src="${logoSrc || `${SITE_URL}/mail/logo-cream-v2.png`}" width="160" height="51" alt="Свадебные секреты" style="display:block;width:160px;height:51px;border:0;"></a>` +
    // статус и имя
    `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:36px 0 0;"><tr>` +
    `<td bgcolor="${bg}" style="background:${bg};border-radius:999px;padding:6px 12px;${font}font-size:14px;line-height:1;font-weight:600;color:${fg};">${escHtml(label)}</td></tr></table>` +
    `<h1 class="h1" style="margin:14px 0 18px;${font}font-size:28px;line-height:1.2;font-weight:700;color:${ink};">${escHtml(title)}</h1>` +
    lines.map(p).join('') +
    reasonHtml +
    after.map(p).join('') +
    // кнопка
    `<table role="presentation" class="btn" cellpadding="0" cellspacing="0" style="margin:26px 0 0;"><tr>` +
    `<td bgcolor="${ink}" style="background:${ink};border-radius:14px;">` +
    `<a href="${cabinet}" style="display:inline-block;padding:16px 28px;${font}font-size:17px;line-height:1;font-weight:600;color:#ffffff;text-decoration:none;border-radius:14px;">Открыть кабинет</a>` +
    `</td></tr></table>` +
    `<p style="margin:14px 0 0;${font}font-size:14px;line-height:1.45;color:${ink};">или по адресу <a href="${cabinet}" style="color:${ink};">wed-secrets.ru/profi/moi</a></p>` +
    // подвал
    `<p style="margin:44px 0 0;${font}font-size:13px;line-height:1.45;color:${ink};">Свадебные секреты, кабинет подрядчика.<br>Письмо отправлено автоматически, отвечать на него не нужно.</p>` +
    `</td></tr></table></td></tr></table></body></html>`;
}

/**
 * Уведомление подрядчику: письмо на почту учётки (как было) и сообщение
 * в мессенджеры по vendorChannels. Мессенджеры — только при
 * VENDOR_MESSENGER_NOTIFY=1 в окружении базы: это сообщения людям, тексты
 * и включение — с согласия Никиты (CLAUDE.md, «сообщения людям»).
 * Не часть действия: сбой отправки модерацию не роняет.
 */
function notifyVendor(app, vendorId, subject, html, text) {
  mailVendor(app, vendorId, subject, html);
  if ($os.getenv('VENDOR_MESSENGER_NOTIFY') !== '1' || !text) return;
  // кнопка под сообщением (Никита 05.11: «включай с правками»)
  const button = { text: 'Открыть кабинет', url: `${SITE_URL}/profi/moi/` };
  try {
    const vendor = app.findRecordById('vendors', vendorId);
    const ch = vendorChannels(vendor);
    if (ch.telegram) telegramTo(vendor.getString('telegramId'), text, button);
    if (ch.max) require(`${__hooks}/lib/max.js`).send(vendor.getString('maxId'), text, button);
  } catch (err) {
    app.logger().warn('cabinet: уведомление подрядчику не ушло', 'vendor', vendorId, 'error', String(err));
  }
}

function mailVendor(app, vendorId, subject, html) {
  try {
    const vendor = app.findRecordById('vendors', vendorId);
    // учётка без почты (вход только через мессенджер) — письма нет, это не сбой
    if (!vendor.email()) return;
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

// ---------- карточка, которую ведём мы (пилот, 03.11) ----------
// Наши заведённые карточки переходят к владельцам в режиме «ведём мы»
// (docs/cabinet/CABINET.md §24, решение Никиты 03.11): визитку держит JSON в git,
// владелец сам меняет только цену, ответы на вопросы, контакты и видео,
// а описание и фото — просьбой (requests), правим руками. Признак —
// form.managed у карточки: form пишет только суперпользователь
// (scripts/card-to-form.mjs), подрядчик в карточку не пишет никогда.
// 07.11 (Никита): владелец сам ставит портрет, строку под именем (tagline,
// до 80 знаков) и короткое «О себе» (intro, до 600 знаков) — оно встаёт
// первым абзацем текста визитки; остальной текст по-прежнему наш.
const MANAGED_KEYS = ['priceMode', 'priceFrom', 'priceNote', 'filters', 'contacts', 'videos', 'requests', 'tagline', 'intro'];
const MANAGED_TAGLINE_MAX = 80;
const MANAGED_INTRO_MAX = 600;

/** карточка правки, если она в режиме «ведём мы»; иначе null */
function managedCard(app, rev) {
  if (rev.getString('kind') !== 'specialist') return null;
  const cardId = rev.getString('specialist');
  if (!cardId) return null;
  const card = findOne(app, 'specialists', 'id = {:id}', { id: cardId });
  return card && jsonOf(card, 'form').managed === true ? card : null;
}

/** анкета правки: всё из карточки, от владельца — только разрешённое */
function lockManaged(form, data) {
  const out = JSON.parse(JSON.stringify(form || {}));
  for (const k of MANAGED_KEYS) if (data && k in data) out[k] = data[k];
  out.managed = true;
  if ('tagline' in out) out.tagline = str(out.tagline, MANAGED_TAGLINE_MAX);
  if ('intro' in out) out.intro = str(out.intro, MANAGED_INTRO_MAX);
  // тарифы у этих карточек — в тексте визитки, их правим мы
  out.tariffs = [];
  if (out.priceMode !== 'request') out.priceMode = 'one';
  return out;
}

/** просьбы владельца одной строкой — для группы модерации и письма */
function requestsText(data) {
  const r = data.requests && typeof data.requests === 'object' ? data.requests : {};
  return [['текст', r.text], ['фото', r.photos]]
    .filter((x) => str(x[1]))
    .map((x) => `${x[0]}: ${str(x[1], 1000)}`)
    .join('\n');
}

// ---------- отправка на модерацию ----------
/** что мешает отправить ревизию на проверку; пустой список — можно */
function submitProblems(rev, managed) {
  const data = jsonOf(rev, 'data');
  const kind = rev.getString('kind');
  const problems = [];
  if (!str(data.name)) problems.push(kind === 'venue' ? 'укажите название площадки' : 'укажите имя или название');
  if (!rev.getString('slug')) problems.push('выберите адрес страницы');
  if (kind === 'specialist' && !rev.getString('categorySlug')) problems.push('выберите категорию');
  const photos = photosOf(rev).length;
  if (photos < MIN_PHOTOS) problems.push(`загрузите не меньше ${MIN_PHOTOS} фото (сейчас ${photos})`);
  if (textLength(data) < MIN_ABOUT) problems.push(`напишите текст карточки подробнее — от ${MIN_ABOUT} знаков`);
  else if (!looksLikeText(data)) problems.push('в тексте карточки должны быть слова — напишите о себе по-настоящему');
  // у «ведём мы» текст наш — проверяем только то, что владелец пишет сам
  // (строку под именем и «О себе», 07.11), как и с контактами ниже
  if (managed ? hasEmoji(data.tagline) || hasEmoji(data.intro) : emojiInText(data)) {
    problems.push('уберите смайлики из описания — на сайте их не будет');
  }
  const price = priceFromOf(data);
  if (price !== null && price > MAX_PRICE) problems.push('проверьте цену — больше 50 млн ₽ не бывает');
  if (tariffsOf(data).some((t) => t.price !== null && t.price > MAX_PRICE)) problems.push('проверьте цены в прайсе');
  const contacts = data.contacts && typeof data.contacts === 'object' ? data.contacts : {};
  if (!str(contacts.phone)) problems.push('укажите телефон в блоке «Контакты» — клиент откроет его кнопкой');
  // у карточки «ведём мы» текст наш, владелец его не правит — проверяем
  // только то, что он вписал сам (просьбы нам — не витрина, их не трогаем)
  const hit = managed ? findContact({ priceNote: data.priceNote, filters: data.filters, tagline: data.tagline, intro: data.intro }, '') : findContact(data, '');
  if (hit) {
    problems.push(
      `в разделе «${fieldLabel(hit.path)}» ${hit.what}. Телефон, почту и ссылки на соцсети можно добавлять только в раздел «Контакты»`
    );
  }
  return problems;
}

// ---------- один телефон — не больше чем в трёх карточках ----------
// Евгений, 02.11: заводил две карточки на один номер. Учётка и так держит
// до 3 карточек (MAX_CARDS), но вторая учётка (почта + Telegram) обходит
// это — номер телефона в контактах обойти сложнее. Считаем карточки сайта
// (кроме архивных) и новые незакрытые ревизии; своя карточка не в счёт.
const MAX_CARDS_PER_PHONE = 3;

function phoneKey(v) {
  return str(v).replace(/[^\d]/g, '').replace(/^8(?=\d{10}$)/, '7');
}

function phoneProblem(app, rev) {
  const data = jsonOf(rev, 'data');
  const phone = phoneKey(data.contacts && data.contacts.phone);
  if (phone.length < 10) return '';
  const tail = phone.slice(-10);
  const own = rev.getString('venue') || rev.getString('specialist') || '';
  const seen = {};
  for (const c of ['venues', 'specialists']) {
    // грубо по подстроке, точно — ниже; номер в базе хранится по-разному
    const list = app.findRecordsByFilter(c, 'contacts ~ {:t} && status != "archived"', '', 0, 0, { t: tail });
    for (const card of list) {
      if (card.id === own) continue;
      if (phoneKey(jsonOf(card, 'contacts').phone) === phone) seen[card.id] = true;
    }
  }
  const revs = app.findRecordsByFilter('revisions', `data ~ {:t} && venue = "" && specialist = "" && ${OPEN_FILTER}`, '', 0, 0, { t: tail });
  for (const r of revs) {
    if (r.id === rev.id) continue;
    const c = jsonOf(r, 'data').contacts;
    if (c && phoneKey(c.phone) === phone) seen[r.id] = true;
  }
  const n = Object.keys(seen).length;
  return n >= MAX_CARDS_PER_PHONE
    ? `этот телефон уже указан в ${n} карточках — один номер можно указать не больше чем в ${MAX_CARDS_PER_PHONE}`
    : '';
}

/** ссылки на видео — настоящие адреса, а не обрывок текста */
function videoProblem(data) {
  const list = (Array.isArray(data.videos) ? data.videos : []).map((v) => str(v && v.url, 1000)).filter((u) => !!u);
  if (list.length > MAX_VIDEOS) return `не больше ${MAX_VIDEOS} ссылок на видео`;
  return list.some((u) => !/^https?:\/\/\S+\.\S+/.test(u)) ? 'проверьте ссылку на видео — она начинается с https://' : '';
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
  if (cardCount(e.app, e.auth.id) >= MAX_CARDS) {
    throw new BadRequestError(`На одной учётке не больше ${MAX_CARDS} карточек.`);
  }
  photoLimit(e.app, r);
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

  // «ведём мы»: фото и обложку меняем мы по просьбе, портрет владелец ставит
  // сам (07.11); из анкеты доходит только разрешённое — остальное как в карточке
  const managed = isNewCard ? null : managedCard(e.app, r);
  if (managed) {
    denyExtra(body, ['data', 'status', 'avatar']);
    r.set('data', lockManaged(jsonOf(managed, 'form'), jsonOf(r, 'data')));
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

  photoLimit(e.app, r);
  const submitting = to === 'review';
  if (submitting) {
    const problems = submitProblems(r, !!managed);
    const phone = phoneProblem(e.app, r);
    if (phone) problems.push(phone);
    const video = videoProblem(jsonOf(r, 'data'));
    if (video) problems.push(video);
    const stale = staleProblem(e.app, r);
    if (stale) problems.push(stale + ' Начните правку заново из карточки.');
    if (problems.length) throw new BadRequestError('Не получилось отправить на проверку: ' + problems.join('; ') + '.');
    r.set('submittedAt', new DateTime());
  }

  e.next();

  if (submitting) {
    const data = jsonOf(r, 'data');
    telegram(`На проверку: ${str(data.name, 120)} (${r.getString('kind') === 'venue' ? 'площадка' : r.getString('categorySlug')})` +
      `${isNewCard ? ', новая карточка' : managed ? ', правка (ведём мы)' : ', правка'}\n${SITE_URL}/profi/admin/moderaciya/pravka/?id=${r.id}` +
      (managed && requestsText(data) ? `\nПросит поправить —\n${requestsText(data)}` : ''));
    // тексты для мессенджеров согласованы Никитой 05.11 («включай с правками»); менять — с его согласия
    notifyVendor(e.app, r.getString('owner'), 'Карточка отправлена на проверку — WED Secrets',
      vendorMail({
        status: 'info',
        label: 'На проверке',
        title: str(data.name, 120),
        lines: ['Получили вашу карточку и проверим её в ближайшее время.', 'Когда она появится на сайте, пришлём письмо со ссылкой.'],
      }),
      `Получили вашу карточку «${str(data.name, 120)}» и проверим её в ближайшее время. Когда она появится на сайте, пришлём ссылку.`);
    // сервис фото: «Готово» — нарезка кадров начинается сразу, к одобрению всё готово
    queuePhotos(r);
  }
}

// ---------- модерация ----------
function moderateRevision(e) {
  const r = e.record;
  const from = r.original().getString('status');
  const to = r.getString('status');
  // Модератор (не суперпользователь) решает, а не правит: из запроса —
  // только статус и причина. Иначе вместе с одобрением можно подменить
  // карточку (specialist/venue + baseVersion), владельца, текст или фото.
  if (!e.hasSuperuserAuth()) {
    denyExtra(e.requestInfo().body, ['status', 'rejectReason']);
    if (to !== from && to !== 'approved' && to !== 'rejected') {
      throw new BadRequestError('Модератор может одобрить правку или вернуть её с причиной.');
    }
  }
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
    notifyVendor(app, r.getString('owner'), 'Карточка опубликована — WED Secrets',
      vendorMail({
        status: 'ok',
        label: 'На сайте',
        title: str(data.name, 120),
        lines: [
          `Карточку одобрили — она уже на сайте: <a href="${escHtml(url)}" style="color:#1e242e;">${escHtml(url.replace(/^https?:\/\//, ''))}</a>`,
          'Теперь в кабинете можно добавить видео — пришлите ссылку на Яндекс.Диск, ролики мы обработаем сами.',
        ],
      }),
      `Карточку «${str(data.name, 120)}» одобрили — она уже на сайте: ${url}
Теперь в кабинете можно добавить видео.`);
    return;
  }

  if (to === 'rejected') {
    if (from !== 'review') throw new BadRequestError('Вернуть можно только карточку на проверке.');
    const reason = str(r.getString('rejectReason'));
    if (!reason) throw new BadRequestError('Напишите причину в поле rejectReason — без неё подрядчик не поймёт, что исправить.');
    r.set('reviewedAt', new DateTime());
    e.next();
    const data = jsonOf(r, 'data');
    notifyVendor(e.app, r.getString('owner'), 'Карточку нужно поправить — WED Secrets',
      vendorMail({
        status: 'bad',
        label: 'Нужно поправить',
        title: str(data.name, 120),
        lines: ['Мы посмотрели карточку и вернули её на доработку. Вот что поправить:'],
        reason,
        after: ['Поправьте в кабинете и отправьте на проверку снова.'],
      }),
      `Карточку «${str(data.name, 120)}» вернули на доработку.
Что исправить: ${reason}
Поправьте в кабинете и отправьте на проверку снова.`);
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
    if (kind === 'specialist' && jsonOf(card, 'form').managed === true) return approveManaged(app, rev, card);
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
  // СЕРВИС ФОТО (07.11.2026): имя файла при копировании СОХРАНЯЕМ (true) —
  // по имени лежат варианты, нарезанные по «Готово», и после одобрения они
  // находятся без повторной нарезки. Кадр, который у карточки уже есть
  // (правка: startEdit скопировал его в ревизию с тем же именем), не
  // копируем вовсе — оставляем файл карточки как был.
  const names = photosOf(rev);
  const has = photosOf(card);
  const fsys = app.newFilesystem();
  try {
    const base = rev.baseFilesPath() + '/';
    card.set('photos', names.map((n) => has.indexOf(n) !== -1 ? n : fsys.getReuploadableFile(base + n, true)));
    if (kind === 'specialist') {
      const avatar = rev.getString('avatar');
      card.set('avatar', !avatar ? null : avatar === card.getString('avatar') ? avatar : fsys.getReuploadableFile(base + avatar, true));
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

/**
 * Одобрение правки карточки «ведём мы»: фото, текст и вид визитки не
 * трогаем (их держит JSON в git), в карточку — только разрешённые поля.
 * На сайт они едут через page.ownerEdits: pb-pull-cabinet кладёт их
 * поверх JSON из git (data/specialists.ts). Просьбы (requests) остаются
 * в ревизии — модератор делает их руками.
 */
function approveManaged(app, rev, card) {
  const data = lockManaged(jsonOf(card, 'form'), jsonOf(rev, 'data'));
  delete data.requests;
  applyData('specialist', card, data);
  card.set('version', card.getInt('version') + 1);
  card.set('form', data);
  card.set('contacts', data.contacts && typeof data.contacts === 'object' ? data.contacts : {});
  // портрет владельца (07.11): новый файл ревизии → карточке, имя сохраняем
  // (сервис фото, как в approve); не загружал — у карточки остаётся прежний
  const avatar = rev.getString('avatar');
  if (avatar && avatar !== card.getString('avatar')) {
    const fsys = app.newFilesystem();
    try {
      card.set('avatar', fsys.getReuploadableFile(rev.baseFilesPath() + '/' + avatar, true));
      app.save(card);
    } finally {
      fsys.close();
    }
  }
  const page = jsonOf(card, 'page');
  page.ownerEdits = {
    priceMode: data.priceMode,
    priceFrom: priceFromOf(data),
    priceNote: str(data.priceNote, 300),
    filters: data.filters && typeof data.filters === 'object' ? data.filters : {},
    tagline: str(data.tagline, MANAGED_TAGLINE_MAX),
    intro: str(data.intro, MANAGED_INTRO_MAX),
    avatar: card.getString('avatar'),
    version: card.getInt('version'),
  };
  card.set('page', page);
  app.save(card);
  rev.set('specialist', card.id);
  rev.set('reviewedAt', new DateTime());
  rev.set('rejectReason', '');
}

/** плоские колонки карточки — по ним фильтрует каталог */
function applyData(kind, card, data) {
  card.set('name', str(data.name, 120));
  const filters = data.filters && typeof data.filters === 'object' ? data.filters : {};
  if (kind === 'specialist') {
    card.set('tagline', str(data.tagline, 200));
    card.set('priceFrom', priceFromOf(data));
    card.set('filters', filters);
    return;
  }
  card.set('address', str(data.address, 300));
  if (!int(data.rentFrom)) data.rentFrom = priceFromOf(data);
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
 * сервер прямо из базы (docs/cabinet/CABINET.md, раздел 11), в src/ их не выгружаем.
 */
function buildPage(kind, card, data, photos, coverIndex) {
  const common = {
    source: 'cabinet',
    slug: card.getString('slug'),
    name: str(data.name, 120),
    about: str(data.about, 20000),
    // текст разделами анкеты — уже разобранный в StorySection
    story: sectionsOf(data).map(parseSection),
    tariffs: tariffsOf(data),
    priceFrom: priceFromOf(data),
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
  common.terms = data.terms && typeof data.terms === 'object' ? data.terms : {};
  for (const key of ['capacityBanquet', 'capacityBuffet', 'checkFrom', 'rentFrom']) common[key] = int(data[key]);
  return common;
}

// ---------- превью анкеты до одобрения (Никита, 03.11) ----------
// Подрядчик видит страницу один в один с сайтом ещё до решения модератора.
// Ссылка — подписанный токен на 15 минут к одной ревизии; страницу рисует
// серверный Astro (/profi/prevyu/), данные берёт здесь — тем же buildPage,
// что и одобрение, чтобы превью не разошлось с настоящей страницей.
const PREVIEW_TTL = 15 * 60;

function previewSecret() {
  const s = $os.getenv('PREVIEW_SECRET');
  if (!s) throw new BadRequestError('Превью ещё не настроено.');
  return s;
}

/** POST /api/wed/preview-link { revision } — ссылка на превью своей анкеты */
function previewLink(e) {
  const body = e.requestInfo().body || {};
  let rev;
  try { rev = e.app.findRecordById('revisions', str(body.revision, 40)); } catch (_) {
    throw new NotFoundError('Анкета не найдена.');
  }
  if (rev.getString('owner') !== e.auth.id) throw new ForbiddenError('Это не ваша анкета.');
  if (rev.getString('kind') !== 'specialist') throw new BadRequestError('Превью площадки пока нет — оно появится вместе со страницами площадок из кабинета.');
  const t = $security.createJWT({ rev: rev.id }, previewSecret(), PREVIEW_TTL);
  return e.json(200, { url: `/profi/prevyu/?t=${encodeURIComponent(t)}` });
}

/** ревизия по подписанной 15-минутной ссылке превью (?t=) */
function previewRevision(e) {
  const t = str(e.request.url.query().get('t'), 2000);
  let claims;
  try { claims = $security.parseJWT(t, previewSecret()); } catch (err) {
    if (err instanceof BadRequestError) throw err;
    throw new BadRequestError('Ссылка на превью устарела — откройте её из кабинета ещё раз.');
  }
  try { return { rev: e.app.findRecordById('revisions', str(claims.rev, 40)), t }; } catch (_) {
    throw new NotFoundError('Анкета не найдена — возможно, её удалили.');
  }
}

/** GET /api/wed/preview?t= — тело страницы для превью (как page у карточки) */
function previewData(e) {
  const { rev, t } = previewRevision(e);
  const data = jsonOf(rev, 'data');
  const names = photosOf(rev);
  // revision подставляется вместо карточки: slug, категория и портрет у неё свои
  const page = buildPage('specialist', rev, data, names, Math.max(0, names.indexOf(rev.getString('cover'))));
  // Файлы ревизии закрыты. Раньше здесь выдавался ключ владельца на чтение
  // файлов — он уходил в адреса картинок страницы и открывал ВСЕ закрытые
  // файлы подрядчика (аудит 05.11). Теперь кадры отдаёт previewFile по той же
  // 15-минутной ссылке и только кадры этой анкеты; ключа наружу нет.
  return e.json(200, {
    page,
    status: rev.getString('status'),
    files: `/api/wed/preview-file?t=${encodeURIComponent(t)}&n=`,
  });
}

/** GET /api/wed/preview-file?t=&n= — кадр анкеты для превью (только фото и портрет этой ревизии) */
function previewFile(e) {
  const { rev } = previewRevision(e);
  const n = str(e.request.url.query().get('n'), 300);
  if (!n || (!photosOf(rev).includes(n) && rev.getString('avatar') !== n)) throw new NotFoundError('Кадр не найден.');
  const type = /\.png$/i.test(n) ? 'image/png' : /\.webp$/i.test(n) ? 'image/webp' : 'image/jpeg';
  const fsys = e.app.newFilesystem();
  let reader = null;
  try {
    reader = fsys.getReader(rev.baseFilesPath() + '/' + n);
    e.response.header().set('Cache-Control', 'private, max-age=900');
    e.stream(200, type, reader);
  } finally {
    if (reader) reader.close();
    fsys.close();
  }
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
    // все кадры: набор правки при одобрении заменяет набор карточки целиком,
    // обрезка здесь стёрла бы лишние кадры с сайта
    // имена сохраняем (сервис фото): нетронутые кадры правки при одобрении
    // остаются файлами карточки, их варианты уже нарезаны
    rev.set('photos', photos.map((n) => fsys.getReuploadableFile(base + n, true)));
    if (kind === 'specialist' && card.getString('avatar')) {
      rev.set('avatar', fsys.getReuploadableFile(base + card.getString('avatar'), true));
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

// ---------- вход через Telegram ----------
// Учётку подрядчика создаёт только этот маршрут: вместе с подписью
// условий (оферта + согласие на ПДн), без них учётки нет (docs/cabinet/CABINET.md §21).
// MAX — тем же путём (messengerAuth), почта подключится рядом.
const VENDOR_DOCS = ['vendor-offer', 'vendor-pdn'];

/** действующая редакция каждого документа подрядчика; нет хоть одной — регистрация закрыта */
function currentDocs(app) {
  return VENDOR_DOCS.map((kind) => app.findRecordsByFilter('legal_docs', 'kind = {:kind}', '-created', 1, 0, { kind })[0] || null);
}

function sign(app, e, vendor, doc, method) {
  const sig = new Record(app.findCollectionByNameOrId('signatures'));
  sig.set('vendor', vendor.id);
  sig.set('doc', doc.id);
  sig.set('kind', doc.getString('kind'));
  sig.set('docVersion', doc.getString('version'));
  sig.set('docHash', $security.sha256(doc.getString('text')));
  sig.set('checkbox', doc.getString('checkbox'));
  sig.set('method', method);
  sig.set('ip', e.realIP());
  sig.set('userAgent', str(e.request.header.get('User-Agent'), 500));
  app.save(sig);
}

/**
 * Приглашение пилота: личная ссылка привязывает готовую карточку к учётке.
 * В ссылке сам ключ, в базе — его SHA-256 (утёкшая база ключей не выдаёт).
 */
function claimInvite(app, vendor, token) {
  const t = str(token, 200);
  if (!t) return null;
  const inv = findOne(app, 'invites', 'tokenHash = {:h}', { h: $security.sha256(t) });
  if (!inv) throw new BadRequestError('Ссылка-приглашение не найдена — попросите прислать новую.');
  if (inv.getString('usedAt')) {
    if (inv.getString('usedBy') === vendor.id) return inv; // повторный вход по той же ссылке
    throw new BadRequestError('По этой ссылке уже вошли. Если это были не вы — напишите нам.');
  }
  if (inv.getDateTime('expiresAt').unix() < Math.floor(Date.now() / 1000)) {
    throw new BadRequestError('Срок ссылки-приглашения истёк — попросите прислать новую.');
  }
  const kind = inv.getString('venue') ? 'venue' : 'specialist';
  const card = app.findRecordById(cardCollection(kind), inv.getString(cardField(kind)));
  const owner = card.getString('owner');
  if (owner && owner !== vendor.id) throw new BadRequestError('У этой карточки уже есть владелец — напишите нам.');
  if (owner !== vendor.id && cardCount(app, vendor.id) >= MAX_CARDS) {
    throw new BadRequestError(`На одной учётке не больше ${MAX_CARDS} карточек — напишите нам.`);
  }
  card.set('owner', vendor.id);
  app.save(card);
  inv.set('usedAt', new DateTime());
  inv.set('usedBy', vendor.id);
  app.save(inv);
  return inv;
}

/**
 * POST /api/wed/telegram { tg: {данные виджета}, accept?: true, invite?: ключ }
 *   учётка есть           → вход (токен как у обычного входа)
 *   нет и accept не стоит → { status: 'needs-accept' }: кабинет показывает условия
 *   нет и accept          → учётка + подписи + вход
 */
function telegramAuth(e) {
  const body = e.requestInfo().body || {};
  const botToken = $os.getenv('TG_BOT_TOKEN');
  if (!botToken) throw new BadRequestError('Вход через Telegram ещё не настроен.');
  const tg = require(`${__hooks}/lib/telegram.js`).verifyTelegram(body.tg, botToken);
  return messengerAuth(e, body, 'telegramId', tg, 'telegram');
}

/**
 * POST /api/wed/max { code, accept?: true, invite?: ключ } — то же, что
 * у Telegram, только аккаунт подтверждает бот (lib/max.js):
 *   человек ещё не нажал «Начать» → { status: 'waiting' }, сайт спросит снова
 */
function maxAuth(e) {
  const body = e.requestInfo().body || {};
  const max = require(`${__hooks}/lib/max.js`);
  const who = max.confirmed(e.app, body.code);
  if (!who) return e.json(200, { status: 'waiting' });
  const res = messengerAuth(e, body, 'maxId', { id: who.id, name: who.name }, 'max');
  // вошли — код больше не нужен; ждём условий — код ещё понадобится
  if (findOne(e.app, 'vendors', 'maxId = {:id}', { id: who.id })) e.app.delete(who.login);
  return res;
}

/**
 * POST /api/wed/link { tg } | { code } — «Подключить» из профиля: второй
 * мессенджер к ТОЙ ЖЕ учётке, а не новая учётка (разбор Никиты 05.11).
 * Аккаунт подтверждается так же, как при входе (подпись Telegram, бот MAX).
 * Мессенджер уже у другой учётки:
 *   та пустая (ни карточек, ни ревизий, ни почты — зашли разок мимо) — забираем;
 *   у неё есть данные — отказ: сливать учётки руками, через нас.
 * Уведомления о заявках в новый канал включаются сразу (правило «куда вошёл,
 * туда и заявки»; выключить — тумблером в профиле).
 */
function linkMessenger(e) {
  const body = e.requestInfo().body || {};
  let field, ch, who, maxLogin = null;
  if (body.code !== undefined) {
    const c = require(`${__hooks}/lib/max.js`).confirmed(e.app, body.code);
    if (!c) return e.json(200, { status: 'waiting' });
    field = 'maxId'; ch = 'max'; who = c.id; maxLogin = c.login;
  } else {
    const botToken = $os.getenv('TG_BOT_TOKEN');
    if (!botToken) throw new BadRequestError('Вход через Telegram ещё не настроен.');
    field = 'telegramId'; ch = 'telegram';
    who = require(`${__hooks}/lib/telegram.js`).verifyTelegram(body.tg, botToken).id;
  }
  const name = ch === 'max' ? 'MAX' : 'Telegram';
  const me = e.app.findRecordById('vendors', e.auth.id);
  const other = findOne(e.app, 'vendors', `${field} = {:id} && id != {:me}`, { id: who, me: me.id });
  if (other) {
    const busy = cardCount(e.app, other.id) > 0
      || !!findOne(e.app, 'revisions', 'owner = {:v}', { v: other.id })
      || !!other.getString('email');
    if (busy) throw new BadRequestError(`Этот ${name} уже подключён к другой учётке с карточками. Войдите через ${name}, чтобы работать с ними, или напишите в поддержку из раздела «Помощь» — объединим учётки.`);
  }
  e.app.runInTransaction((tx) => {
    if (other) {
      const o = tx.findRecordById('vendors', other.id);
      o.set(field, '');
      tx.save(o);
    }
    const m = tx.findRecordById('vendors', me.id);
    m.set(field, who);
    let n = null;
    try { n = JSON.parse(m.getString('notify') || 'null'); } catch (_) {}
    // настройки уже трогали — включаем новый канал; не трогали — он и так включён по умолчанию
    if (n && typeof n === 'object' && Object.keys(n).length) m.set('notify', Object.assign({}, n, { [ch]: true }));
    tx.save(m);
    if (maxLogin) tx.delete(tx.findRecordById('max_logins', maxLogin.id));
  });
  return e.json(200, { status: 'linked', record: e.app.findRecordById('vendors', me.id) });
}

/**
 * общий вход через мессенджер: field — telegramId | maxId
 *   учётка есть           → вход (токен как у обычного входа)
 *   нет и accept не стоит → { status: 'needs-accept' }: кабинет показывает условия
 *   нет и accept          → учётка + подписи + вход
 */
function messengerAuth(e, body, field, who, method) {
  let vendor = findOne(e.app, 'vendors', `${field} = {:id}`, { id: who.id });
  if (!vendor) {
    if (body.accept !== true) return e.json(200, { status: 'needs-accept', name: who.name });
    const docs = currentDocs(e.app);
    if (docs.some((d) => !d)) throw new BadRequestError('Условия работы ещё не опубликованы — регистрация пока закрыта.');
    e.app.runInTransaction((tx) => {
      vendor = new Record(tx.findCollectionByNameOrId('vendors'));
      vendor.set(field, who.id);
      vendor.set('name', who.name);
      vendor.setPassword($security.randomString(40));
      tx.save(vendor);
      for (const d of docs) sign(tx, e, vendor, d, method);
      if (body.invite) claimInvite(tx, vendor, body.invite);
    });
  } else if (body.invite) {
    e.app.runInTransaction((tx) => claimInvite(tx, vendor, body.invite));
  }
  return $apis.recordAuthResponse(e, vendor, method);
}

// ---------- вход по почте ----------
// Регистрация почтой — тем же правилом, что у мессенджеров: учётка только
// вместе с подписью условий. Почту подтверждает код из письма: сайт сам
// запрашивает его (request-otp), вход кодом делает учётку verified, а без
// verified пароль не пускает (authRule). Сброс пароля — тоже кодом.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_PASSWORD = 8;

function checkPassword(p) {
  const s = typeof p === 'string' ? p : '';
  if (s.length < MIN_PASSWORD) throw new BadRequestError(`Пароль — не короче ${MIN_PASSWORD} знаков.`);
  if (s.length > 72) throw new BadRequestError('Пароль слишком длинный — не больше 72 знаков.');
  return s;
}

/**
 * POST /api/wed/register { email, password, accept: true, invite? }
 * Учётка без подтверждённой почты — дальше сайт присылает код. Почта уже
 * есть, но не подтверждена (бросили на полпути) — новый пароль и подпись:
 * войти этим паролем всё равно нельзя, пока не введён код из письма.
 */
function emailRegister(e) {
  const body = e.requestInfo().body || {};
  const email = str(body.email, 200).toLowerCase();
  if (!EMAIL_RE.test(email)) throw new BadRequestError('Проверьте адрес почты.');
  const password = checkPassword(body.password);
  if (body.accept !== true) throw new BadRequestError('Отметьте оба пункта условий.');
  const docs = currentDocs(e.app);
  if (docs.some((d) => !d)) throw new BadRequestError('Условия работы ещё не опубликованы — регистрация пока закрыта.');

  let vendor = findOne(e.app, 'vendors', 'email = {:email}', { email });
  if (vendor && vendor.verified()) {
    throw new BadRequestError('Учётка с этой почтой уже есть — войдите или восстановите пароль.');
  }
  e.app.runInTransaction((tx) => {
    if (!vendor) {
      vendor = new Record(tx.findCollectionByNameOrId('vendors'));
      vendor.set('email', email);
      vendor.set('emailVisibility', false);
      vendor.setVerified(false);
    }
    vendor.setPassword(password);
    tx.save(vendor);
    for (const d of docs) sign(tx, e, vendor, d, 'email');
    if (body.invite) claimInvite(tx, vendor, body.invite);
  });
  return e.json(200, { ok: true });
}

/**
 * Код из письма (сайт запрашивает его штатным request-otp) → вход.
 *   POST /api/wed/confirm        { otpId, code }           — подтвердить почту после регистрации
 *   POST /api/wed/password-reset { otpId, code, password } — новый пароль
 * Штатный auth-with-otp здесь не годится: подтверждая почту, PocketBase
 * заменяет пароль случайным (защита от чужой регистрации на эту почту),
 * и новичок не вошёл бы своим паролем. Та же защита у нас: пароль,
 * заданный до кода, живёт, только если регистрацию повторили (её пароль
 * затирает чужой), а войти паролем без кода нельзя вовсе.
 */
function confirmCode(e) {
  return codeLogin(e, null);
}

function passwordReset(e) {
  return codeLogin(e, checkPassword((e.requestInfo().body || {}).password));
}

function codeLogin(e, password) {
  const body = e.requestInfo().body || {};
  const vendors = e.app.findCollectionByNameOrId('vendors');
  let otp = null;
  try { otp = e.app.findOTPById(str(body.otpId, 40)); } catch (_) {}
  const bad = () => new BadRequestError('Код не подошёл или устарел — запросите новый.');
  if (!otp || otp.collectionRef() !== vendors.id) throw bad();
  if (otp.hasExpired(vendors.otp.duration * 1e9)) { e.app.delete(otp); throw bad(); }
  if (!otp.proxyRecord().validatePassword(str(body.code, 20))) throw bad();

  const vendor = e.app.findRecordById('vendors', otp.recordRef());
  if (password) vendor.setPassword(password);
  if (vendor.email() && otp.sentTo() === vendor.email()) vendor.setVerified(true);
  e.app.save(vendor);
  e.app.delete(otp);
  return $apis.recordAuthResponse(e, vendor, 'otp');
}

/** POST /api/wed/invite { invite } — уже вошедший подрядчик открыл ссылку-приглашение */
function claimInviteRoute(e) {
  const body = e.requestInfo().body || {};
  let inv;
  e.app.runInTransaction((tx) => { inv = claimInvite(tx, e.auth, body.invite); });
  if (!inv) throw new BadRequestError('Нет ключа приглашения.');
  return e.json(200, { ok: true });
}

/** GET /api/wed/my-cards — карточки учётки с открытой правкой, если она есть */
function myCards(e) {
  const out = [];
  for (const kind of ['venue', 'specialist']) {
    const cards = e.app.findRecordsByFilter(cardCollection(kind), 'owner = {:v}', '-updated', 0, 0, { v: e.auth.id });
    for (const c of cards) {
      const open = findOne(e.app, 'revisions', `${cardField(kind)} = {:id} && ${OPEN_FILTER}`, { id: c.id });
      out.push({
        kind,
        id: c.id,
        name: c.getString('name'),
        slug: c.getString('slug'),
        categorySlug: kind === 'venue' ? '' : c.getString('categorySlug'),
        status: c.getString('status'),
        url: cardUrl(kind, c.getString('categorySlug'), c.getString('slug')),
        revision: open ? { id: open.id, status: open.getString('status'), rejectReason: open.getString('rejectReason') } : null,
      });
    }
  }
  return e.json(200, { items: out });
}

// ---------- учётки ----------
function vendorCreateAccount(e) {
  denyExtra(e.requestInfo().body, ['email', 'password', 'passwordConfirm', 'name', 'phone', 'kind', 'emailVisibility']);
  return e.next();
}
function vendorUpdateAccount(e) {
  const body = e.requestInfo().body;
  denyExtra(body, ['name', 'phone', 'notify']);
  // куда присылать заявки: только известные ключи и только нужных типов;
  // Telegram и MAX — лишь при подключённом входе (бот пишет тем, кто приходил)
  if (body && 'notify' in body) {
    // JSON-поле записи PocketBase кладёт в тело запроса сырыми байтами
    // (types.JSONRaw), а не объектом: n.email читался как undefined, и почта
    // для заявок не включалась никогда (Никита, 07.11). Приводим к объекту.
    let n = body.notify;
    if (n && typeof n === 'object' && !('email' in n || 'telegram' in n || 'max' in n || 'emailTo' in n)) {
      try { n = JSON.parse(toString(n)); } catch (_) { n = {}; }
    } else if (typeof n === 'string') {
      try { n = JSON.parse(n); } catch (_) { n = {}; }
    }
    if (!n || typeof n !== 'object') n = {};
    const emailTo = str(n.emailTo, 200);
    if (emailTo && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailTo)) throw new BadRequestError('Проверьте почту для заявок.');
    const r = e.record;
    r.set('notify', {
      telegram: n.telegram === true && !!r.getString('telegramId'),
      max: n.max === true && !!r.getString('maxId'),
      email: n.email === true && !!emailTo,
      emailTo,
    });
  }
  return e.next();
}

// ---------- заявки пар ----------
// Форма на карточке (BookingSheet) без входа → POST /api/wed/lead. Служебное
// (статус, связь с учёткой невесты) из запроса не берём. Частоту держит
// rate limit маршрута (миграция 1762200000).
function createLead(e) {
  const body = e.requestInfo().body || {};
  const name = str(body.name, 120);
  const phone = str(body.phone, 40);
  const message = str(body.message, 4000);
  const sourceUrl = str(body.sourceUrl, 500);
  if (!name) throw new BadRequestError('Напишите, как вас зовут.');
  if (phone.replace(/\D/g, '').length < 10) throw new BadRequestError('Проверьте телефон — нужно 10 цифр и больше.');
  if (body.consent !== true) throw new BadRequestError('Нужно согласие на обработку данных.');
  const eventDate = /^\d{4}-\d{2}-\d{2}$/.test(str(body.eventDate)) ? str(body.eventDate) + ' 12:00:00.000Z' : '';
  const col = e.app.findCollectionByNameOrId('leads');
  const save = (app, msg, url) => {
    const r = new Record(col);
    r.set('kind', 'client');
    r.set('name', name);
    r.set('phone', phone);
    r.set('message', msg);
    if (/^https?:\/\//.test(url)) r.set('sourceUrl', url);
    if (eventDate) r.set('eventDate', eventDate);
    r.set('consent', true);
    r.set('status', 'new');
    app.save(r);
  };

  // «Написать всем» из избранного (06.11): одним запросом список карточек
  // { name, url } — по заявке на каждую (у каждой свой адресат), но одно
  // уведомление нам. Лимит частоты маршрута считает это одним запросом.
  if (Array.isArray(body.cards)) {
    const cards = body.cards
      .map((c) => ({ name: str(c && c.name, 200), url: str(c && c.url, 500) }))
      .filter((c) => c.name)
      .slice(0, 50);
    if (!cards.length) throw new BadRequestError('Отметьте, кому написать.');
    // все или ничего: половина заявок без второй половины — хуже ошибки
    e.app.runInTransaction((tx) => {
      for (const c of cards) save(tx, `Карточка: ${c.name}\nИз избранного, всем сразу (${cards.length})\n${message}`.trim(), c.url);
    });
    const list = cards.map((c) => `— ${c.name}${c.url ? ` ${c.url}` : ''}`).join('\n');
    const text = `Заявка из избранного, ${cards.length} карточ.\n${name}, ${phone}\n${message}\n${list}`;
    telegram(text);
    mailUs(`Заявка из избранного: ${name}, ${cards.length}`, text);
    return e.json(200, { ok: true, count: cards.length });
  }

  save(e.app, message, sourceUrl);
  const text = `Заявка с сайта\n${name}, ${phone}\n${message}\n${sourceUrl}`;
  telegram(text);
  mailUs(`Заявка с сайта: ${name}`, text);
  return e.json(200, { ok: true });
}

// ---------- модератор снимает и удаляет (Никита, 02.11) ----------
// POST /api/wed/mod/remove { what: 'revision' | 'specialist' | 'venue', id, mode }
//   revision            — удалить новую карточку / правку (ещё не на сайте)
//   карточка, archive   — снять с сайта: status = archived (cardSaved → выкладка)
//   карточка, delete    — удалить запись совсем; только уже снятую (archived),
//                         чтобы опубликованная не пропала одним нажатием
function modRemove(e) {
  if (!isModerator(e)) throw new ForbiddenError('Только для модераторов.');
  const body = e.requestInfo().body || {};
  const what = str(body.what);
  const id = str(body.id, 40);
  if (!id) throw new BadRequestError('Не указана карточка.');
  if (what === 'revision') {
    const rev = e.app.findRecordById('revisions', id);
    e.app.delete(rev);
    return e.json(200, { ok: true, removed: 'revision' });
  }
  if (what !== 'specialist' && what !== 'venue') throw new BadRequestError('Неизвестный вид карточки.');
  const card = e.app.findRecordById(cardCollection(what), id);
  if (str(body.mode) === 'delete') {
    if (card.getString('status') !== 'archived') throw new BadRequestError('Сначала снимите карточку с сайта.');
    // открытые правки этой карточки — вместе с ней, иначе висят в очереди
    for (const r of e.app.findRecordsByFilter('revisions', `${cardField(what)} = {:id}`, '', 0, 0, { id })) e.app.delete(r);
    e.app.delete(card);
    return e.json(200, { ok: true, removed: 'card' });
  }
  card.set('status', 'archived');
  e.app.save(card);
  return e.json(200, { ok: true, archived: true });
}

/** карточку из кабинета удалили совсем — сайт пересобрать без неё */
function cardDeleted(e) {
  // раздел подрядчиков — с сервера из базы (этап 2): удалённая карточка
  // исчезает с сайта сама, пересборка не нужна
  e.next();
}

module.exports = {
  createLead,
  modRemove,
  cardDeleted,
  cardSaved,
  MIN_PHOTOS,
  parseSection,
  managedCard,
  photoCap,
  MAX_PHOTOS,
  isModerator,
  telegramAuth,
  maxAuth,
  linkMessenger,
  previewLink,
  previewData,
  previewFile,
  emailRegister,
  confirmCode,
  passwordReset,
  claimInviteRoute,
  myCards,
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
