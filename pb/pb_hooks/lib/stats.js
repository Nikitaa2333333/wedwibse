/// <reference path="../../pb_data/types.d.ts" />
// СТАТИСТИКА КАРТОЧЕК (14.11.2026, docs/cabinet/STATS.md, миграция 1762900000).
//
// Откуда цифры:
//   переходы и посетители — Яндекс Метрика (счётчик сайта), раз в час по крону
//     забираем вчера и сегодня одним запросом «просмотры по адресам страниц»;
//     досчёт истории — POST /api/wed/mod/stats-sync { days };
//   откуда пришли         — заходы, начавшиеся с карточки, по источникам Метрики;
//   избранное             — свой счётчик POST /api/wed/hit (сердце .save на сайте);
//   заявки                — leads (связь с карточкой), считаем на лету.
// Нет данных за день — строки нет (экран рисует пусто, а не ноль).
// METRIKA_TOKEN — OAuth-токен с правом metrika:read, в окружении базы; без него
// синхронизация молчит, остальное работает.

const COUNTER = '113797542';
const API = 'https://api-metrika.yandex.net/stat/v1/data';
const BOT_UA = /bot|crawl|spider|slurp|yandex(?!browser)|googlebot|bingpreview|headless|lighthouse|pagespeed|curl|wget|python|node-fetch/i;

function cab() {
  return require(`${__hooks}/lib/cabinet.js`);
}

/** сегодняшний день по Москве, YYYY-MM-DD (сервер живёт в UTC) */
function mskDay(offsetDays) {
  const d = new Date(Date.now() + 3 * 3600 * 1000 - (offsetDays || 0) * 86400 * 1000);
  return d.toISOString().slice(0, 10);
}

/** строка «карточка × день» — найти или завести (без сохранения) */
function rowFor(app, card, day) {
  const field = card.kind;
  const found = cab().findOne(app, 'card_stats', `${field} = {:id} && day = {:day}`, { id: card.record.id, day });
  if (found) return found;
  const r = new Record(app.findCollectionByNameOrId('card_stats'));
  r.set(field, card.record.id);
  r.set('day', day);
  return r;
}

/**
 * POST /api/wed/hit { url } — пара добавила карточку в избранное (сердце на сайте).
 * Без учётки и без персональных данных: только +1 к счётчику дня. Боты и запросы
 * не с нашего сайта не считаются. Отвечаем 204 всегда — sendBeacon ответ не читает.
 */
function hit(e) {
  try {
    const info = e.requestInfo();
    const ua = String(info.headers['user_agent'] || '');
    const site = String(info.headers['sec_fetch_site'] || '');
    if (!ua || BOT_UA.test(ua) || (site && site !== 'same-origin')) return e.noContent(204);
    let body = info.body || {};
    // sendBeacon шлёт text/plain — тогда тело приходит строкой
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
    const card = cab().cardOfUrl(e.app, cab().str(body.url, 500));
    if (!card) return e.noContent(204);
    const r = rowFor(e.app, card, mskDay(0));
    r.set('favs', r.getInt('favs') + 1);
    e.app.save(r);
  } catch (err) {
    e.app.logger().warn('stats: hit не записан', 'error', String(err));
  }
  return e.noContent(204);
}

/** запрос к API отчётов Метрики; без токена — null */
function metrika(params) {
  const token = $os.getenv('METRIKA_TOKEN');
  if (!token) return null;
  const qs = Object.keys(params).map((k) => `${k}=${encodeURIComponent(params[k])}`).join('&');
  const res = $http.send({ url: `${API}?ids=${COUNTER}&accuracy=full&limit=100000&${qs}`, method: 'GET', headers: { authorization: `OAuth ${token}` }, timeout: 60 });
  if (res.statusCode !== 200) throw new Error(`Метрика ответила ${res.statusCode}: ${toString(res.body).slice(0, 300)}`);
  return res.json;
}

/**
 * Забрать из Метрики просмотры, посетителей и источники за последние days дней
 * (сегодня включительно) и разложить по строкам карточек. Повторный прогон
 * перезаписывает те же цифры — без задвоения. favs не трогаем.
 */
function syncMetrika(app, days) {
  const n = Math.max(1, Math.min(365, days | 0));
  const date1 = mskDay(n - 1);
  const date2 = mskDay(0);
  const pv = metrika({
    dimensions: 'ym:pv:date,ym:pv:URLPath',
    metrics: 'ym:pv:pageviews,ym:pv:users',
    filters: "ym:pv:URLPath=~'^/moskva/'",
    date1, date2,
  });
  if (!pv) return { ok: false, reason: 'нет METRIKA_TOKEN' };
  const src = metrika({
    dimensions: 'ym:s:date,ym:s:startURLPath,ym:s:lastTrafficSource',
    metrics: 'ym:s:visits',
    filters: "ym:s:startURLPath=~'^/moskva/'",
    date1, date2,
  });

  // адрес → карточка: кэш, чтобы не искать одну и ту же карточку сотни раз
  const cards = {};
  const cardOf = (path) => {
    if (!(path in cards)) cards[path] = cab().cardOfUrl(app, path);
    return cards[path];
  };
  // ключ «id карточки|день» → накопленные цифры (у одной карточки бывает
  // несколько адресов: со слэшем и без, с параметрами — Метрика их разделяет)
  const acc = {};
  const slot = (card, day) => {
    const key = `${card.kind}:${card.record.id}|${day}`;
    if (!acc[key]) acc[key] = { card, day, views: 0, visitors: 0, src: {} };
    return acc[key];
  };
  for (const row of pv.data || []) {
    const day = row.dimensions[0].name;
    const card = cardOf(row.dimensions[1].name);
    if (!card) continue;
    const s = slot(card, day);
    s.views += Math.round(row.metrics[0]);
    s.visitors += Math.round(row.metrics[1]);
  }
  for (const row of (src && src.data) || []) {
    const day = row.dimensions[0].name;
    const card = cardOf(row.dimensions[1].name);
    if (!card) continue;
    const id = row.dimensions[2].id || 'other';
    const s = slot(card, day);
    s.src[id] = (s.src[id] || 0) + Math.round(row.metrics[0]);
  }

  let saved = 0;
  app.runInTransaction((tx) => {
    for (const key of Object.keys(acc)) {
      const a = acc[key];
      const r = rowFor(tx, a.card, a.day);
      r.set('views', a.views);
      r.set('visitors', a.visitors);
      r.set('src', a.src);
      tx.save(r);
      saved++;
    }
  });
  return { ok: true, from: date1, to: date2, rows: saved };
}

/** POST /api/wed/mod/stats-sync { days } — досчитать историю (модератор) */
function syncRoute(e) {
  if (!cab().isModerator(e)) throw new ForbiddenError('Только для модераторов.');
  const body = e.requestInfo().body || {};
  return e.json(200, syncMetrika(e.app, Number(body.days) || 30));
}

/** крон: раз в час — вчера и сегодня (вчерашний день Метрика ещё досчитывает) */
function cron() {
  try {
    const r = syncMetrika($app, 2);
    if (!r.ok) return;
  } catch (err) {
    $app.logger().warn('stats: синхронизация с Метрикой не прошла', 'error', String(err));
  }
}

// ---------- чтение ----------

/** дни периода по Москве: [самый ранний … сегодня] */
function dayList(n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(mskDay(i));
  return out;
}

/** UTC-строка created → день по Москве */
function createdDay(created) {
  const d = new Date(String(created).replace(' ', 'T'));
  return new Date(d.getTime() + 3 * 3600 * 1000).toISOString().slice(0, 10);
}

/**
 * Ряды по карточкам за период: { id, kind, name, url, categorySlug,
 * views[], visitors[], favs[], leads[], src{} } — массивы по дням периода,
 * null там, где данных за день нет (пусто, а не ноль).
 */
function seriesFor(app, cards, days) {
  const list = dayList(days);
  const idx = {};
  list.forEach((d, i) => { idx[d] = i; });
  const first = list[0];
  // с какого дня вообще есть цифры — экран пишет «считаем с …»
  let since = { views: '', favs: '' };
  const out = cards.map((c) => {
    const empty = () => list.map(() => null);
    const s = { id: c.record.id, kind: c.kind, name: c.record.getString('name'), url: cardUrl(c), categorySlug: c.kind === 'venue' ? 'ploshchadki' : c.record.getString('categorySlug'), views: empty(), visitors: empty(), favs: empty(), leads: list.map(() => 0), src: {} };
    for (const r of app.findRecordsByFilter('card_stats', `${c.kind} = {:id} && day >= {:first}`, 'day', 0, 0, { id: c.record.id, first })) {
      const i = idx[r.getString('day')];
      if (i === undefined) continue;
      const v = r.getInt('views'), u = r.getInt('visitors'), f = r.getInt('favs');
      if (v || u) { s.views[i] = v; s.visitors[i] = u; }
      if (f) s.favs[i] = f;
      let src = {};
      try { src = JSON.parse(toString(r.get('src')) || '{}') || {}; } catch (_) {}
      for (const k of Object.keys(src)) s.src[k] = (s.src[k] || 0) + (Number(src[k]) || 0);
    }
    for (const l of app.findRecordsByFilter('leads', `${c.kind} = {:id} && status != "spam" && created >= {:from}`, '', 0, 0, { id: c.record.id, from: `${first} 00:00:00` })) {
      const i = idx[createdDay(l.getString('created'))];
      if (i !== undefined) s.leads[i]++;
    }
    return s;
  });
  // «с какого дня считаем»: первый день в базе вообще (не только в периоде)
  try {
    const v = app.findRecordsByFilter('card_stats', 'views > 0', 'day', 1, 0);
    if (v.length) since.views = v[0].getString('day');
    const f = app.findRecordsByFilter('card_stats', 'favs > 0', 'day', 1, 0);
    if (f.length) since.favs = f[0].getString('day');
  } catch (_) {}
  return { days: list, cards: out, since };
}

function cardUrl(c) {
  const slug = c.record.getString('slug');
  return c.kind === 'venue' ? `/moskva/ploshchadki/${slug}/` : `/moskva/podryadchiki/${c.record.getString('categorySlug')}/${slug}/`;
}

function periodOf(e) {
  const d = Number(e.request.url.query().get('days'));
  return [7, 30, 90].indexOf(d) >= 0 ? d : 30;
}

/** GET /api/wed/my-stats?days=7|30|90 — опубликованные карточки подрядчика */
function myStats(e) {
  const cards = [];
  for (const kind of ['specialist', 'venue']) {
    for (const r of e.app.findRecordsByFilter(kind === 'venue' ? 'venues' : 'specialists', 'owner = {:v} && status = "published"', 'name', 0, 0, { v: e.auth.id })) cards.push({ kind, record: r });
  }
  return e.json(200, seriesFor(e.app, cards, periodOf(e)));
}

/** GET /api/wed/mod/stats?days=7|30|90 — все опубликованные карточки (модератор) */
function modStats(e) {
  if (!cab().isModerator(e)) throw new ForbiddenError('Только для модераторов.');
  const cards = [];
  for (const kind of ['specialist', 'venue']) {
    for (const r of e.app.findRecordsByFilter(kind === 'venue' ? 'venues' : 'specialists', 'status = "published"', 'name', 0, 0)) cards.push({ kind, record: r });
  }
  return e.json(200, seriesFor(e.app, cards, periodOf(e)));
}

module.exports = { hit, syncMetrika, syncRoute, cron, myStats, modStats, mskDay };
