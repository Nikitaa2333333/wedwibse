// Фото по ссылке на Яндекс Диск (docs/cabinet/CABINET.md §13, STAGE2 «Фото по ссылке»).
// Сервер ходит в официальный API публичных ресурсов — без ключа и без
// доступа к диску подрядчика: видно только то, что он сам открыл ссылкой.
//   GET  /api/wed/yadisk/list?url=…              — кадры папки с превью (до 2 уровней вложенности)
//   POST /api/wed/yadisk/import {revision,url,paths} — до 5 выбранных кадров в фото ревизии
// Очереди нет: экран шлёт выбранное пачками по 5 и показывает «N из M»
// (закрыли вкладку — догрузка встала, уже забранное остаётся).
// Оригинал берём, если он JPEG/PNG/WebP и до 15 МБ (лимит поля photos);
// HEIC и тяжёлые — копией Яндекса до 3000 px по длинной стороне.

const API = 'https://cloud-api.yandex.net/v1/disk/public/resources';
const HOSTS = /^(?:disk\.yandex\.(?:ru|com|by|kz)|disk\.360\.yandex\.ru|yadi\.sk)$/i;
const IMAGE = /\.(jpe?g|png|webp|heic|heif)$/i;
const OK_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 15000000;
const MAX_ITEMS = 600;
const PER_IMPORT = 5;

/** только публичные ссылки Яндекс Диска — сервер не ходит по чужим адресам */
function publicKey(raw) {
  const url = String(raw || '').trim();
  const m = url.match(/^https:\/\/([^/?#]+)\//i);
  if (!m || !HOSTS.test(m[1])) throw new BadRequestError('Нужна ссылка на Яндекс Диск — она начинается с https://disk.yandex.ru/ или https://yadi.sk/.');
  return url;
}

/** запрос с повтором: cloud-api временами не отвечает на первое соединение (как в fetch-yadisk.mjs) */
function send(req) {
  let last;
  for (let i = 0; i < 3; i++) {
    try {
      const res = $http.send(req);
      if (res.statusCode < 500) return res;
      last = new Error(`ответ ${res.statusCode}`);
    } catch (err) {
      last = err;
    }
  }
  throw new BadRequestError('Яндекс Диск не отвечает — попробуйте ещё раз через минуту.', { cause: String(last) });
}

function api(params, timeout, suffix) {
  const qs = Object.keys(params).map((k) => `${k}=${encodeURIComponent(params[k])}`).join('&');
  const res = send({ url: `${API}${suffix || ''}?${qs}`, method: 'GET', timeout: timeout || 20 });
  if (res.statusCode === 404) throw new BadRequestError('По ссылке ничего не нашлось — проверьте, что доступ открыт «всем, у кого есть ссылка».');
  if (res.statusCode !== 200) throw new BadRequestError(`Яндекс Диск не ответил (${res.statusCode}) — попробуйте ещё раз через минуту.`);
  return res.json;
}

function list(e) {
  const key = publicKey(e.requestInfo().query.url);
  const items = [];
  let videos = 0; // ролики в папке — только счёт, чтобы экран сказал «в папке только видео»
  let title = '';
  const walk = (path, depth) => {
    for (let offset = 0; items.length < MAX_ITEMS; offset += 200) {
      const p = { public_key: key, limit: 200, offset, preview_size: '400x', preview_crop: 'false' };
      if (path) p.path = path;
      const j = api(p);
      if (!path) title = j.name || '';
      // ссылка на один файл, а не на папку
      if (j.type === 'file') {
        if (j.media_type === 'image' || IMAGE.test(j.name)) items.push({ path: j.path || '/', name: j.name, preview: j.preview || '', size: j.size || 0 });
        return;
      }
      const page = (j._embedded && j._embedded.items) || [];
      const dirs = [];
      for (const it of page) {
        if (it.type === 'dir') dirs.push(it.path);
        else if (it.media_type === 'video') videos++;
        else if (it.media_type === 'image' || IMAGE.test(it.name)) {
          items.push({ path: it.path, name: it.name, preview: it.preview || '', size: it.size || 0, folder: path ? path.split('/').pop() : '' });
        }
        if (items.length >= MAX_ITEMS) break;
      }
      if (depth < 2) for (const d of dirs) { if (items.length >= MAX_ITEMS) break; walk(d, depth + 1); }
      if (page.length < 200) return;
    }
  };
  walk('', 0);
  return e.json(200, { title, items, videos, capped: items.length >= MAX_ITEMS });
}

/**
 * Ссылка на оригинал. Документированный /download отвечает 429 «Слишком много
 * запросов» вразнобой — даже на запросы по одному и с паузой 8 с (07.11.2026:
 * у подрядчика не забрались 7 из 9 кадров). Поэтому: /download с повтором,
 * затем поле file из сведений о файле — в документации его нет, но это прямая
 * ссылка на тот же оригинал (md5 всех 6 «упавших» кадров совпал). Нет ни того,
 * ни другого — null, и fetchFile возьмёт копию Диска до 3000 px.
 */
function originalUrl(key, path, meta) {
  for (let i = 0; i < 3; i++) {
    try {
      const res = send({ url: `${API}/download?public_key=${encodeURIComponent(key)}&path=${encodeURIComponent(path)}`, method: 'GET', timeout: 20 });
      if (res.statusCode === 200 && res.json && res.json.href) return res.json.href;
      if (res.statusCode !== 429) break;
    } catch (_) { break; }
    sleep(700 * (i + 1));
  }
  return meta.file || null;
}

function download(url) {
  const res = send({ url, method: 'GET', timeout: 120 });
  if (res.statusCode !== 200) throw new Error(`диск ответил ${res.statusCode}`);
  if (!res.body || !res.body.length || res.body.length > MAX_BYTES) throw new Error('файл пустой или больше 15 МБ');
  return res.body;
}

/** файл с диска: оригинал, если влезает в поле photos, иначе копия до 3000 px */
function fetchFile(key, path) {
  const meta = api({ public_key: key, path, preview_size: '3000x', preview_crop: 'false' });
  const fits = OK_MIME.indexOf(meta.mime_type) !== -1 && meta.size > 0 && meta.size <= MAX_BYTES;
  let body = null;
  let original = false;
  if (fits) {
    const url = originalUrl(key, path, meta);
    if (url) {
      try {
        const b = download(url);
        // недокачанный оригинал не берём — лучше целая копия
        if (b.length === meta.size) { body = b; original = true; }
      } catch (_) {}
    }
    if (!original) $app.logger().info('yadisk: оригинал не отдался, беру копию до 3000 px', 'path', path);
  }
  if (!body) {
    if (!meta.preview) throw new Error(fits ? 'Диск не отдал ни оригинал, ни копию' : 'нет ссылки на файл');
    body = download(meta.preview);
  }
  const base = String(meta.name || 'photo').replace(/\.[^.]+$/, '').replace(/[^\wа-яё-]+/gi, '_').slice(0, 60) || 'photo';
  return $filesystem.fileFromBytes(body, `${base}.${original ? meta.name.split('.').pop().toLowerCase() : 'jpg'}`);
}

function importPhotos(e) {
  const cab = require(`${__hooks}/lib/cabinet.js`);
  const body = e.requestInfo().body;
  const key = publicKey(body.url);
  const paths = [].concat(body.paths || []).map(String).filter((p) => !!p);
  if (!paths.length) throw new BadRequestError('Выберите кадры.');
  if (paths.length > PER_IMPORT) throw new BadRequestError(`За раз — не больше ${PER_IMPORT} кадров.`);

  let rev;
  try {
    rev = e.app.findRecordById('revisions', String(body.revision || ''));
  } catch (_) {
    throw new NotFoundError('Карточка не найдена.');
  }
  if (rev.getString('owner') !== e.auth.id) throw new ForbiddenError('Это не ваша карточка.');
  const status = rev.getString('status');
  if (status !== 'draft' && status !== 'rejected') throw new BadRequestError('Карточка на проверке или уже опубликована — фото добавляются в черновик.');
  if (cab.managedCard(e.app, rev)) throw new BadRequestError('Фото этой карточки подбираем мы — напишите в «Что поменять в фото».');

  // уже забранное с этой ссылки (revisions.yadisk) не берём второй раз, пока
  // файл в карточке: оборванная пачка дозабирается сервером, а экран шлёт её снова
  const photos = rev.getStringSlice('photos').filter((n) => !!n);
  let seen = {};
  try { seen = JSON.parse(rev.getString('yadisk') || '{}') || {}; } catch (_) {}
  const ref = (p) => `${key}#${p}`;
  const fresh = paths.filter((p) => !(seen[ref(p)] && photos.indexOf(seen[ref(p)]) !== -1));
  const already = paths.length - fresh.length;

  const have = photos.length;
  const cap = cab.photoCap(e.app, rev);
  if (have + fresh.length > cap) throw new BadRequestError(`На карточке до ${cap} фото, сейчас ${have} — можно добавить ещё ${Math.max(0, cap - have)}.`);

  const files = [];
  const from = [];
  const skipped = [];
  for (const p of fresh) {
    try {
      files.push(fetchFile(key, p));
      from.push(p);
    } catch (err) {
      skipped.push({ path: p, reason: String(err && err.message ? err.message : err) });
    }
  }
  // причина остаётся в журнале базы: экран показывает подрядчику только имена файлов
  if (skipped.length) $app.logger().warn('yadisk: кадры не забрались', 'revision', rev.id, 'skipped', JSON.stringify(skipped));
  if (files.length) {
    rev.set('photos+', files);
    e.app.save(rev);
    // имена файлам база даёт при сохранении — сопоставляем по порядку добавления
    const after = rev.getStringSlice('photos');
    const added = after.slice(after.length - files.length);
    const map = {};
    for (const k in seen) if (after.indexOf(seen[k]) !== -1) map[k] = seen[k]; // удалённые фото — забыть
    from.forEach((p, i) => { map[ref(p)] = added[i]; });
    rev.set('yadisk', map);
    e.app.save(rev);
  }
  return e.json(200, { record: rev, added: files.length, already, skipped });
}

module.exports = { list, importPhotos, publicKey };
