// Проверка правил кабинета подрядчика на живом PocketBase:
//   node scripts/pb-test-cabinet.mjs
// Нужны PB_URL, PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD (.env) и база, запущенная
// с хуками: pocketbase serve --hooksDir pb/pb_hooks --migrationsDir pb/pb_migrations.
//
// Главное, что проверяем (CABINET.md, 10.1 п. 3): подрядчик не может
// опубликовать себя сам, не видит чужого и не меняет служебных полей.
// Скрипт заводит двух тестовых подрядчиков, проходит весь путь
// черновик → проверка → одобрение → правка и в конце всё за собой удаляет.
// Не запускать на боевой базе в часы, когда идёт модерация: тестовые
// карточки на секунды появляются в очереди.
import { loadEnv } from './pb-lib.mjs';

const cfg = await loadEnv();
const URL_ = cfg.url;
const stamp = Date.now().toString(36);

// 1×1 PNG: PocketBase проверяет тип по содержимому, пустышка не пройдёт
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const ABOUT = 'Снимаю свадьбы двенадцать лет. Работаю в репортажной манере, без постановки и долгих позирований, ' +
  'чтобы в кадр попадали живые эмоции гостей и пары. Готовые фотографии отдаю за три недели.';

async function call(token, method, path, body) {
  const isForm = body instanceof FormData;
  const r = await fetch(URL_ + path, {
    method,
    headers: { ...(token ? { authorization: token } : {}), ...(body && !isForm ? { 'content-type': 'application/json' } : {}) },
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: r.status, json, text };
}

let passed = 0;
const failures = [];
function check(name, ok, detail = '') {
  if (ok) { passed++; console.log(`  ✓ ${name}`); }
  else { failures.push(name); console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); }
}
const refused = (res) => res.status >= 400 && res.status < 500;
const says = (res, piece) => (res.json?.message ?? res.text).includes(piece);

// ---------- подготовка ----------
const su = await call(null, 'POST', '/api/collections/_superusers/auth-with-password', { identity: cfg.email, password: cfg.password });
if (su.status !== 200) throw new Error('нет доступа суперпользователя: ' + su.text);
const SU = su.json.token;

const cleanup = { revisions: [], specialists: [], vendors: [], video_requests: [] };

async function makeVendor(tag) {
  const pass = crypto.randomUUID();
  const v = await call(SU, 'POST', '/api/collections/vendors/records', {
    email: `cabinet-test-${tag}-${stamp}@example.com`, password: pass, passwordConfirm: pass, name: `Тест ${tag}`,
  });
  if (v.status !== 200) throw new Error('vendor: ' + v.text);
  cleanup.vendors.push(v.json.id);
  const imp = await call(SU, 'POST', `/api/collections/vendors/impersonate/${v.json.id}`, { duration: 3600 });
  if (imp.status !== 200) throw new Error('impersonate: ' + imp.text);
  return { id: v.json.id, token: imp.json.token };
}

const A = await makeVendor('a');
const B = await makeVendor('b');
const slug = `test-foto-${stamp}`;

console.log('\nчерновик');
let res = await call(A.token, 'POST', '/api/collections/revisions/records', {
  owner: A.id, kind: 'specialist', categorySlug: 'fotografy', slug, status: 'approved', data: { name: 'Анна' },
});
check('нельзя создать сразу одобренной', refused(res), res.text);

res = await call(A.token, 'POST', '/api/collections/revisions/records', {
  owner: B.id, kind: 'specialist', categorySlug: 'fotografy', slug, status: 'draft', data: { name: 'Анна' },
});
check('нельзя создать черновик от чужого имени', refused(res), res.text);

res = await call(A.token, 'POST', '/api/collections/revisions/records', {
  owner: A.id, kind: 'specialist', categorySlug: 'fotografy', slug, status: 'draft', data: { name: 'Анна' }, rejectReason: 'x',
});
check('нельзя передать служебное поле', refused(res) && says(res, 'rejectReason'), res.text);

res = await call(A.token, 'POST', '/api/collections/revisions/records', {
  owner: A.id, kind: 'specialist', categorySlug: 'fotografy', slug, status: 'draft',
  data: { name: 'Анна Фото', about: 'Звоните +7 916 123-45-67, ' + ABOUT, contacts: { phone: '+7 916 000-00-00' } },
});
check('черновик создаётся', res.status === 200, res.text);
const rev = res.json;
cleanup.revisions.push(rev?.id);

res = await call(B.token, 'POST', '/api/collections/revisions/records', {
  owner: B.id, kind: 'specialist', categorySlug: 'fotografy', slug, status: 'draft', data: { name: 'Не Анна' },
});
check('занятый адрес не отдаётся второму', refused(res) && says(res, 'занят'), res.text);

res = await call(B.token, 'GET', `/api/wed/slug?kind=specialist&category=fotografy&slug=${slug}`);
check('проверка адреса предлагает свободный', res.json?.free === false && res.json?.suggestion === `${slug}-2`, res.text);

res = await call(B.token, 'GET', `/api/collections/revisions/records`);
check('чужие черновики не видны', res.status === 200 && res.json.items.every((x) => x.owner === B.id), res.text);

res = await call(B.token, 'PATCH', `/api/collections/revisions/records/${rev.id}`, { data: { name: 'взлом' } });
check('чужой черновик не правится', refused(res), res.text);

console.log('\nотправка на проверку');
res = await call(A.token, 'PATCH', `/api/collections/revisions/records/${rev.id}`, { status: 'approved' });
check('нельзя одобрить себя', refused(res), res.text);

res = await call(A.token, 'PATCH', `/api/collections/revisions/records/${rev.id}`, { owner: B.id });
check('нельзя сменить владельца', refused(res), res.text);

res = await call(A.token, 'POST', '/api/collections/specialists/records', { slug: 'hack', categorySlug: 'fotografy', citySlug: 'moskva', name: 'x', status: 'published' });
check('в карточки сайта писать нельзя', refused(res), res.text);

res = await call(A.token, 'PATCH', `/api/collections/revisions/records/${rev.id}`, { status: 'review' });
check('без фото не отправить', refused(res) && says(res, 'фото'), res.text);
check('телефон в «О себе» ловится', says(res, 'телефон') && says(res, 'О себе'), res.text);

const form = new FormData();
for (let i = 0; i < 8; i++) form.append('photos', new Blob([PNG], { type: 'image/png' }), `p${i}.png`);
form.append('data', JSON.stringify({ name: 'Анна Фото', about: ABOUT, priceFrom: '80 000', contacts: { phone: '+7 916 000-00-00' }, filters: { style: ['reportage'] } }));
res = await call(A.token, 'PATCH', `/api/collections/revisions/records/${rev.id}`, form);
check('фото загружаются', res.status === 200 && res.json.photos.length === 8, res.text);

res = await fetch(`${URL_}/api/files/revisions/${rev.id}/${res.json?.photos?.[0]}`);
check('фото черновика закрыты по прямой ссылке', res.status >= 400, String(res.status));

res = await call(A.token, 'PATCH', `/api/collections/revisions/records/${rev.id}`, { status: 'review' });
check('отправка на проверку', res.status === 200 && res.json.status === 'review', res.text);

res = await call(A.token, 'PATCH', `/api/collections/revisions/records/${rev.id}`, { data: { name: 'Подмена' } });
check('на проверке не правится', refused(res), res.text);

console.log('\nмодерация');
res = await call(SU, 'PATCH', `/api/collections/revisions/records/${rev.id}`, { status: 'rejected' });
check('вернуть без причины нельзя', refused(res) && says(res, 'причин'), res.text);

res = await call(SU, 'PATCH', `/api/collections/revisions/records/${rev.id}`, { status: 'approved' });
check('одобрение', res.status === 200 && res.json.status === 'approved' && !!res.json.specialist, res.text);
const cardId = res.json?.specialist;
cleanup.specialists.push(cardId);

res = await call(null, 'GET', `/api/collections/specialists/records/${cardId}`);
check('карточка опубликована и видна гостю', res.status === 200 && res.json.status === 'published' && res.json.owner === A.id, res.text);
check('контакты не отдаются публично', res.json && !('contacts' in res.json) && !('form' in res.json), Object.keys(res.json ?? {}).join(','));
check('фото перенесены в карточку', res.json?.photos?.length === 8 && res.json?.page?.photos?.length === 8, res.text);
check('плоские колонки заполнены', res.json?.priceFrom === 80000 && res.json?.version === 1, res.text);

res = await call(A.token, 'PATCH', `/api/collections/revisions/records/${rev.id}`, { data: { name: 'После одобрения' } });
check('одобренная версия не правится', refused(res), res.text);

console.log('\nправка опубликованной');
res = await call(B.token, 'POST', '/api/wed/edit', { kind: 'specialist', card: cardId });
check('чужую карточку не открыть на правку', res.status === 403, res.text);

res = await call(A.token, 'POST', '/api/wed/edit', { kind: 'specialist', card: cardId });
check('правка начинается с копии карточки', res.status === 200 && res.json.photos.length === 8 && res.json.data?.name === 'Анна Фото' && res.json.baseVersion === 1, res.text);
const edit = res.json;
cleanup.revisions.push(edit?.id);

res = await call(A.token, 'POST', '/api/wed/edit', { kind: 'specialist', card: cardId });
check('вторая правка не плодится', res.json?.id === edit?.id, res.text);

res = await call(A.token, 'PATCH', `/api/collections/revisions/records/${edit.id}`, { slug: 'drugoy-adres' });
check('адрес опубликованной карточки не меняется из кабинета', refused(res), res.text);

res = await call(A.token, 'PATCH', `/api/collections/revisions/records/${edit.id}`, {
  data: { ...edit.data, about: ABOUT + ' Пишите в телеграм @anna_foto.' }, status: 'review',
});
check('ник в тексте ловится', refused(res) && says(res, 'ник'), res.text);

res = await call(A.token, 'PATCH', `/api/collections/revisions/records/${edit.id}`, { data: { ...edit.data, tagline: 'Репортаж и плёнка' }, status: 'review' });
check('правка уходит на проверку', res.status === 200, res.text);

res = await call(null, 'GET', `/api/collections/specialists/records/${cardId}`);
check('пока правка на проверке, карточка на сайте', res.json?.status === 'published' && res.json?.tagline === '', res.text);

res = await call(SU, 'PATCH', `/api/collections/revisions/records/${edit.id}`, { status: 'rejected', rejectReason: 'Уберите плёнку' });
check('возврат с причиной', res.status === 200 && res.json.status === 'rejected', res.text);

res = await call(A.token, 'PATCH', `/api/collections/revisions/records/${edit.id}`, { data: { ...edit.data, tagline: 'Репортаж' }, status: 'review' });
check('исправленная правка уходит снова', res.status === 200, res.text);

await call(SU, 'PATCH', `/api/collections/specialists/records/${cardId}`, { version: 5 });
res = await call(SU, 'PATCH', `/api/collections/revisions/records/${edit.id}`, { status: 'approved' });
check('устаревшую правку не одобрить', refused(res) && says(res, 'изменилась'), res.text);
res = await call(null, 'GET', `/api/collections/specialists/records/${cardId}`);
check('после отказа карточка не тронута', res.json?.tagline === '' && res.json?.version === 5, res.text);

await call(SU, 'PATCH', `/api/collections/specialists/records/${cardId}`, { version: 1 });
res = await call(SU, 'PATCH', `/api/collections/revisions/records/${edit.id}`, { status: 'approved' });
check('правка одобрена', res.status === 200, res.text);
res = await call(null, 'GET', `/api/collections/specialists/records/${cardId}`);
check('карточка обновилась', res.json?.tagline === 'Репортаж' && res.json?.version === 2 && res.json?.photos?.length === 8, res.text);

console.log('\nвидео');
res = await call(A.token, 'POST', '/api/collections/video_requests/records', { owner: A.id, specialist: cardId, url: 'https://example.com/v.mp4' });
check('ссылка не с диска не принимается', refused(res) && says(res, 'Яндекс'), res.text);

res = await call(B.token, 'POST', '/api/collections/video_requests/records', { owner: B.id, specialist: cardId, url: 'https://cloud.mail.ru/public/abc' });
check('к чужой карточке видео не добавить', refused(res), res.text);

res = await call(A.token, 'POST', '/api/collections/video_requests/records', { owner: A.id, specialist: cardId, url: 'https://cloud.mail.ru/public/abc/def', status: 'done' });
check('статус заявки на видео не задаётся подрядчиком', refused(res), res.text);

res = await call(A.token, 'POST', '/api/collections/video_requests/records', { owner: A.id, specialist: cardId, url: 'https://cloud.mail.ru/public/abc/def', comment: 'два ролика' });
check('заявка на видео принята', res.status === 200 && res.json.status === 'new', res.text);
cleanup.video_requests.push(res.json?.id);

console.log('\nучётка');
// скрытые поля (balance, trialUntil, notes) PocketBase молча отбрасывает
// из запроса не-суперпользователя — проверяем само значение, а не код ответа
await call(A.token, 'PATCH', `/api/collections/vendors/records/${A.id}`, { balance: 100000, trialUntil: '2030-01-01 00:00:00Z' });
res = await call(SU, 'GET', `/api/collections/vendors/records/${A.id}`);
check('баланс и триал себе не начислить', res.json?.balance === 0 && !res.json?.trialUntil, res.text);
res = await call(A.token, 'PATCH', `/api/collections/vendors/records/${A.id}`, { name: 'Анна' });
check('имя меняется', res.status === 200, res.text);
res = await call(B.token, 'GET', `/api/collections/vendors/records/${A.id}`);
check('чужая учётка не видна', res.status === 404, res.text);

// ---------- уборка ----------
for (const [col, ids] of Object.entries(cleanup)) {
  for (const id of ids.filter(Boolean)) await call(SU, 'DELETE', `/api/collections/${col}/records/${id}`);
}

console.log(`\n${passed} прошло, ${failures.length} не прошло`);
if (failures.length) process.exit(1);
