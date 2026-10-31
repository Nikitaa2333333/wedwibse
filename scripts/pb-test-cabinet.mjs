// Проверка правил кабинета подрядчика на живом PocketBase:
//   node scripts/pb-test-cabinet.mjs
// Нужны PB_URL, PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD (.env) и база, запущенная
// с хуками: pocketbase serve --hooksDir pb/pb_hooks --migrationsDir pb/pb_migrations.
// Вход через Telegram проверяется, если в окружении скрипта есть тот же
// TG_BOT_TOKEN, с которым запущена база (подпись виджета считаем сами).
// Против боевой базы — только с ТЕСТОВЫМ токеном нельзя: там настоящий бот,
// поэтому на сервере раздел Telegram пропускается без токена.
//
// Главное, что проверяем (CABINET.md, 10.1 п. 3): подрядчик не может
// опубликовать себя сам, не видит чужого и не меняет служебных полей.
// Скрипт заводит двух тестовых подрядчиков, проходит весь путь
// черновик → проверка → одобрение → правка и в конце всё за собой удаляет.
// Не запускать на боевой базе в часы, когда идёт модерация: тестовые
// карточки на секунды появляются в очереди.
import { createHash, createHmac } from 'node:crypto';
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

const cleanup = { invites: [], signatures: [], revisions: [], specialists: [], vendors: [], video_requests: [], moderators: [], legal_docs: [], max_logins: [] };

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

async function makeModerator() {
  const pass = crypto.randomUUID();
  const email = `cabinet-test-mod-${stamp}@example.com`;
  const m = await call(SU, 'POST', '/api/collections/moderators/records', { email, password: pass, passwordConfirm: pass, name: 'Модератор' });
  if (m.status !== 200) throw new Error('moderator: ' + m.text);
  cleanup.moderators.push(m.json.id);
  const a = await call(null, 'POST', '/api/collections/moderators/auth-with-password', { identity: email, password: pass });
  if (a.status !== 200) throw new Error('moderator auth: ' + a.text);
  return { id: m.json.id, token: a.json.token };
}

const M = await makeModerator();
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
res = await call(M.token, 'GET', `/api/collections/revisions/records?filter=${encodeURIComponent('status = "review"')}&expand=owner`);
check('модератор видит очередь с учёткой', res.status === 200 && res.json.items.some((x) => x.id === rev.id && x.expand?.owner?.id === A.id), res.text);

res = await call(A.token, 'PATCH', `/api/collections/revisions/records/${rev.id}`, { status: 'review', rejectReason: 'x' });
check('подрядчик не пишет причину возврата', refused(res), res.text);

res = await call(M.token, 'PATCH', `/api/collections/revisions/records/${rev.id}`, { status: 'approved', data: { name: 'Подмена' } });
check('модератор не правит текст вместе с одобрением', refused(res), res.text);
res = await call(M.token, 'PATCH', `/api/collections/revisions/records/${rev.id}`, { owner: B.id });
check('модератор не меняет владельца', refused(res), res.text);
res = await call(M.token, 'PATCH', `/api/collections/revisions/records/${rev.id}`, { status: 'draft' });
check('модератор не переводит в черновик', refused(res), res.text);

res = await call(M.token, 'PATCH', `/api/collections/revisions/records/${rev.id}`, { status: 'rejected' });
check('вернуть без причины нельзя', refused(res) && says(res, 'причин'), res.text);

res = await call(M.token, 'PATCH', `/api/collections/revisions/records/${rev.id}`, { status: 'approved' });
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

res = await call(M.token, 'PATCH', `/api/collections/revisions/records/${edit.id}`, { status: 'rejected', rejectReason: 'Уберите плёнку' });
check('возврат с причиной', res.status === 200 && res.json.status === 'rejected', res.text);

res = await call(A.token, 'PATCH', `/api/collections/revisions/records/${edit.id}`, { data: { ...edit.data, tagline: 'Репортаж' }, status: 'review' });
check('исправленная правка уходит снова', res.status === 200, res.text);

await call(SU, 'PATCH', `/api/collections/specialists/records/${cardId}`, { version: 5 });
res = await call(M.token, 'PATCH', `/api/collections/revisions/records/${edit.id}`, { status: 'approved' });
check('устаревшую правку не одобрить', refused(res) && says(res, 'изменилась'), res.text);
res = await call(null, 'GET', `/api/collections/specialists/records/${cardId}`);
check('после отказа карточка не тронута', res.json?.tagline === '' && res.json?.version === 5, res.text);

await call(SU, 'PATCH', `/api/collections/specialists/records/${cardId}`, { version: 1 });
res = await call(M.token, 'PATCH', `/api/collections/revisions/records/${edit.id}`, { status: 'approved' });
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

console.log('\nмоя карточка');
res = await call(A.token, 'GET', '/api/wed/my-cards');
check('подрядчик видит свою карточку', res.status === 200 && res.json.items.length === 1 && res.json.items[0].id === cardId, res.text);
res = await call(B.token, 'GET', '/api/wed/my-cards');
check('у второго карточек нет', res.status === 200 && res.json.items.length === 0, res.text);

console.log('\nлимиты');
res = await call(M.token, 'POST', '/api/collections/specialists/records', { slug: 'mod-hack', categorySlug: 'fotografy', citySlug: 'moskva', name: 'x', status: 'published' });
check('модератор не пишет в карточки напрямую', refused(res), res.text);
const extra = [];
for (let i = 0; i < 3; i++) {
  res = await call(A.token, 'POST', '/api/collections/revisions/records', {
    owner: A.id, kind: 'specialist', categorySlug: 'vedushchie', slug: `test-lim-${stamp}-${i}`, status: 'draft', data: { name: 'Лимит' },
  });
  if (res.status === 200) { extra.push(res.json.id); cleanup.revisions.push(res.json.id); }
}
// у A уже одна опубликованная карточка: свободно ещё две
check('не больше трёх карточек на учётку', extra.length === 2 && says(res, 'не больше'), res.text);
const many = new FormData();
for (let i = 0; i < 51; i++) many.append('photos', new Blob([PNG], { type: 'image/png' }), `m${i}.png`);
res = await call(A.token, 'PATCH', `/api/collections/revisions/records/${extra[0]}`, many);
check('больше 50 фото не принимается', refused(res) && says(res, '50'), res.text);

console.log('\nполная анкета');
const full = await call(B.token, 'POST', '/api/collections/revisions/records', {
  owner: B.id, kind: 'specialist', categorySlug: 'fotografy', slug: `test-full-${stamp}`, status: 'draft',
  data: { name: 'Борис', sections: [{ title: 'Как я снимаю', body: 'ы'.repeat(200) }], contacts: { phone: '+7 916 000-00-01' } },
});
cleanup.revisions.push(full.json?.id);
const fullPhotos = new FormData();
for (let i = 0; i < 8; i++) fullPhotos.append('photos', new Blob([PNG], { type: 'image/png' }), `f${i}.png`);
res = await call(B.token, 'PATCH', `/api/collections/revisions/records/${full.json?.id}`, fullPhotos);
res = await call(B.token, 'PATCH', `/api/collections/revisions/records/${full.json?.id}`, { status: 'review' });
check('«ыыыы» без слов не проходит', refused(res) && says(res, 'слова'), res.text);
const good = {
  name: 'Борис', tagline: 'Репортаж',
  sections: [
    { title: 'Как я снимаю', body: ABOUT + '\n\n— репортаж\n— плёнка\n\nПишу заранее план дня.' },
    // подводка в одном абзаце со списком — до списка (прогон 27.10)
    { title: 'Что получаете', body: 'В день съёмки:\n— 500 кадров\n— галерея' },
  ],
  tariffs: [{ name: 'Полный день', price: '40000', includes: '— 10 часов\n— 500 кадров' }, { name: 'Половина дня', price: '25000', includes: '' }],
  filters: { style: ['reportage'] },
  contacts: { phone: '+7 916 000-00-01' },
};
res = await call(B.token, 'PATCH', `/api/collections/revisions/records/${full.json?.id}`, { data: { ...good, tariffs: [{ name: 'Ошибка', price: '3000000000000' }] }, status: 'review' });
check('цена с опечаткой не проходит', refused(res) && says(res, 'цен'), res.text);
const order = (await call(B.token, 'GET', `/api/collections/revisions/records/${full.json?.id}`)).json.photos;
res = await call(B.token, 'PATCH', `/api/collections/revisions/records/${full.json?.id}`, { photos: [...order].reverse() });
check('порядок фото меняется', res.status === 200 && res.json.photos[0] === order[order.length - 1], res.text);
res = await call(B.token, 'PATCH', `/api/collections/revisions/records/${full.json?.id}`, { data: good, status: 'review' });
check('полная анкета уходит на проверку', res.status === 200, res.text);
res = await call(M.token, 'PATCH', `/api/collections/revisions/records/${full.json?.id}`, { status: 'approved' });
check('полная анкета одобрена', res.status === 200, res.text);
cleanup.specialists.push(res.json?.specialist);
res = await call(null, 'GET', `/api/collections/specialists/records/${res.json?.specialist}`);
const story = res.json?.page?.story ?? [];
check('разделы текста разобраны в story', story.length === 2 && story[0].title === 'Как я снимаю' && story[0].list?.length === 2 && story[0].after?.length === 1 && story[1].list?.length === 2 && story[1].text?.[0] === 'В день съёмки:' && !story[1].after, JSON.stringify(story));
check('цена от — самый дешёвый пакет', res.json?.priceFrom === 25000 && res.json?.page?.tariffs?.[0]?.includes?.length === 2, res.text);
check('первым кадром — обложка в новом порядке', res.json?.page?.photos?.length === 8, res.text);

const BOT = process.env.TG_BOT_TOKEN;
if (!BOT) {
  console.log('\nTelegram — пропуск: нет TG_BOT_TOKEN в окружении скрипта');
} else {
  console.log('\nвход через Telegram');
  const signTg = (data) => {
    const check_ = Object.keys(data).filter((k) => k !== 'hash').sort().map((k) => `${k}=${data[k]}`).join('\n');
    const secret = createHash('sha256').update(BOT).digest();
    return { ...data, hash: createHmac('sha256', secret).update(check_).digest('hex') };
  };
  const tgId = String(9000000000 + Math.floor(Math.random() * 99999999));
  const tgUser = () => signTg({ id: tgId, first_name: 'Евгений', last_name: 'Тест', auth_date: String(Math.floor(Date.now() / 1000)) });

  res = await call(null, 'POST', '/api/wed/telegram', { tg: { ...tgUser(), first_name: 'Подмена' } });
  check('поддельная подпись не входит', res.status === 401, res.text);
  res = await call(null, 'POST', '/api/wed/telegram', { tg: signTg({ id: tgId, first_name: 'Е', auth_date: String(Math.floor(Date.now() / 1000) - 200000) }) });
  check('устаревший вход не принимается', res.status === 401, res.text);
  res = await call(null, 'POST', '/api/wed/telegram', { tg: tgUser() });
  check('новичку сначала показываем условия', res.status === 200 && res.json.status === 'needs-accept', res.text);

  // условия: если в базе нет редакций — заводим тестовые и уберём за собой
  for (const kind of ['vendor-offer', 'vendor-pdn']) {
    const have = await call(SU, 'GET', `/api/collections/legal_docs/records?filter=${encodeURIComponent(`kind = "${kind}"`)}`);
    if (have.json?.items?.length) continue;
    const d = await call(SU, 'POST', '/api/collections/legal_docs/records', {
      kind, version: 'test', title: 'Тест', text: '<p>Тестовый текст</p>', checkbox: 'Согласен',
    });
    cleanup.legal_docs.push(d.json?.id);
  }

  // приглашение на опубликованную карточку B-подрядчика нет — заводим карточку без владельца
  const free = await call(SU, 'POST', '/api/collections/specialists/records', {
    slug: `test-invite-${stamp}`, categorySlug: 'fotografy', citySlug: 'moskva', name: 'Пилот', status: 'published',
  });
  cleanup.specialists.push(free.json?.id);
  const inviteKey = crypto.randomUUID();
  const inv = await call(SU, 'POST', '/api/collections/invites/records', {
    tokenHash: createHash('sha256').update(inviteKey).digest('hex'), specialist: free.json?.id,
    expiresAt: new Date(Date.now() + 86400000).toISOString().replace('T', ' '),
  });
  cleanup.invites.push(inv.json?.id);

  res = await call(null, 'POST', '/api/wed/telegram', { tg: tgUser(), accept: true, invite: inviteKey });
  check('регистрация с условиями и приглашением', res.status === 200 && !!res.json.token && res.json.record?.telegramId === tgId, res.text);
  const T = { id: res.json?.record?.id, token: res.json?.token };
  cleanup.vendors.unshift(T.id);
  const sigs = await call(SU, 'GET', `/api/collections/signatures/records?filter=${encodeURIComponent(`vendor = "${T.id}"`)}`);
  check('подписаны оферта и согласие', sigs.json?.items?.length === 2 && sigs.json.items.every((x) => x.method === 'telegram' && x.docHash.length === 64), sigs.text);
  for (const x of sigs.json?.items ?? []) cleanup.signatures.unshift(x.id);
  res = await call(T.token, 'GET', '/api/wed/my-cards');
  check('карточка по приглашению привязана', res.json?.items?.[0]?.id === free.json?.id, res.text);

  res = await call(null, 'POST', '/api/wed/telegram', { tg: tgUser() });
  check('повторный вход без условий', res.status === 200 && res.json.record?.id === T.id, res.text);
  res = await call(A.token, 'POST', '/api/wed/invite', { invite: inviteKey });
  check('чужое приглашение второй раз не гасится', refused(res), res.text);
  res = await call(null, 'POST', '/api/collections/vendors/records', { email: `x-${stamp}@example.com`, password: 'x1234567890', passwordConfirm: 'x1234567890' });
  check('учётку в обход условий не создать', refused(res), res.text);
}

// ---------- вход через MAX ----------
// Нужен тот же MAX_WEBHOOK_SECRET, с которым запущена база. Ключ бота базе
// здесь давать ТЕСТОВЫЙ (MAX_BOT_TOKEN=test): вебхук отвечает в MAX
// сообщением, а номера пользователей в тесте выдуманные.
const MAX_SECRET = process.env.MAX_WEBHOOK_SECRET;
if (!MAX_SECRET) {
  console.log('\nMAX — пропуск: нет MAX_WEBHOOK_SECRET в окружении скрипта');
} else {
  console.log('\nвход через MAX');
  const hook = (body, secret = MAX_SECRET) => fetch(URL_ + '/api/wed/max/webhook', {
    method: 'POST', headers: { 'content-type': 'application/json', 'X-Max-Bot-Api-Secret': secret }, body: JSON.stringify(body),
  });
  const maxId = String(8000000000 + Math.floor(Math.random() * 99999999));
  const started = (code, id = maxId) => ({ update_type: 'bot_started', timestamp: Date.now(), chat_id: Number(id), user: { user_id: Number(id), name: 'Мария Тест' }, payload: code });

  res = await call(null, 'POST', '/api/wed/max/start');
  const code = res.json?.code;
  check('код и ссылка в бота', res.status === 200 && /^[a-z0-9]{32}$/.test(code) && res.json.link.endsWith(`?start=${code}`), res.text);
  check('вебхук с чужим секретом не принимается', (await hook(started(code), 'wrong-secret')).status === 401);
  res = await call(null, 'POST', '/api/wed/max', { code });
  check('до «Начать» в боте — ждём', res.status === 200 && res.json.status === 'waiting', res.text);
  res = await call(null, 'POST', '/api/wed/max', { code: 'a'.repeat(32) });
  check('выдуманный код не входит', res.status === 400, res.text);

  check('бот подтвердил код', (await hook(started(code))).status === 200);
  check('чужой аккаунт тот же код не перехватит', (await hook(started(code, '7000000001'))).status === 200);
  res = await call(null, 'POST', '/api/wed/max', { code });
  check('новичку сначала условия, имя из MAX', res.status === 200 && res.json.status === 'needs-accept' && res.json.name === 'Мария Тест', res.text);
  for (const kind of ['vendor-offer', 'vendor-pdn']) {
    const have = await call(SU, 'GET', `/api/collections/legal_docs/records?filter=${encodeURIComponent(`kind = "${kind}"`)}`);
    if (have.json?.items?.length) continue;
    const d = await call(SU, 'POST', '/api/collections/legal_docs/records', { kind, version: 'test', title: 'Тест', text: '<p>Тест</p>', checkbox: 'Согласен' });
    cleanup.legal_docs.push(d.json?.id);
  }
  res = await call(null, 'POST', '/api/wed/max', { code, accept: true });
  check('регистрация через MAX с условиями', res.status === 200 && !!res.json.token && res.json.record?.maxId === maxId, res.text);
  const X = { id: res.json?.record?.id };
  cleanup.vendors.unshift(X.id);
  const sigs = await call(SU, 'GET', `/api/collections/signatures/records?filter=${encodeURIComponent(`vendor = "${X.id}"`)}`);
  check('подписи с отметкой max', sigs.json?.items?.length >= 2 && sigs.json.items.every((x) => x.method === 'max'), sigs.text);
  for (const x of sigs.json?.items ?? []) cleanup.signatures.unshift(x.id);
  res = await call(null, 'POST', '/api/wed/max', { code });
  check('код одноразовый', res.status === 400, res.text);

  res = await call(null, 'POST', '/api/wed/max/start');
  await hook(started(res.json?.code));
  res = await call(null, 'POST', '/api/wed/max', { code: res.json?.code });
  check('повторный вход без условий', res.status === 200 && res.json.record?.id === X.id, res.text);
}

// ---------- вход по почте ----------
// Код из письма тест прочитать не может (в базе он хэширован) — заводит
// свой код суперпользователем в _otps, тем же путём, каким база шлёт письмо.
console.log('\nвход по почте');
{
  for (const kind of ['vendor-offer', 'vendor-pdn']) {
    const have = await call(SU, 'GET', `/api/collections/legal_docs/records?filter=${encodeURIComponent(`kind = "${kind}"`)}`);
    if (have.json?.items?.length) continue;
    const d = await call(SU, 'POST', '/api/collections/legal_docs/records', { kind, version: 'test', title: 'Тест', text: '<p>Тест</p>', checkbox: 'Согласен' });
    cleanup.legal_docs.push(d.json?.id);
  }
  const email = `cabinet-mail-${stamp}@example.com`;
  const pass1 = 'first-pass-123';
  const pass2 = 'second-pass-456';
  const vendorsCol = (await call(SU, 'GET', '/api/collections/vendors')).json;
  const code = async (vendorId) => {
    const c = String(Math.floor(100000 + Math.random() * 899999));
    const o = await call(SU, 'POST', '/api/collections/_otps/records', { collectionRef: vendorsCol.id, recordRef: vendorId, password: c, sentTo: email });
    return { otpId: o.json?.id, code: c, raw: o };
  };
  const login = (password) => call(null, 'POST', '/api/collections/vendors/auth-with-password', { identity: email, password });

  res = await call(null, 'POST', '/api/wed/register', { email: 'не-почта', password: pass1, accept: true });
  check('кривая почта не регистрируется', res.status === 400, res.text);
  res = await call(null, 'POST', '/api/wed/register', { email, password: '1234567', accept: true });
  check('короткий пароль не принимается', res.status === 400, res.text);
  res = await call(null, 'POST', '/api/wed/register', { email, password: pass1 });
  check('без условий не регистрируется', res.status === 400, res.text);

  res = await call(null, 'POST', '/api/wed/register', { email: email.toUpperCase(), password: pass1, accept: true });
  check('регистрация по почте с условиями', res.status === 200, res.text);
  const v = (await call(SU, 'GET', `/api/collections/vendors/records?filter=${encodeURIComponent(`email = "${email}"`)}`)).json?.items?.[0];
  cleanup.vendors.unshift(v?.id);
  check('учётка без подтверждённой почты', !!v && v.verified === false, JSON.stringify(v));
  const sigs = await call(SU, 'GET', `/api/collections/signatures/records?filter=${encodeURIComponent(`vendor = "${v?.id}"`)}`);
  check('подписи с отметкой email', sigs.json?.items?.length >= 2 && sigs.json.items.every((x) => x.method === 'email'), sigs.text);
  for (const x of sigs.json?.items ?? []) cleanup.signatures.unshift(x.id);

  res = await login(pass1);
  check('без кода из письма пароль не пускает', refused(res), res.text);
  res = await call(null, 'POST', '/api/collections/vendors/request-otp', { email });
  check('код на почту запрашивается', res.status === 200 && !!res.json?.otpId, res.text);

  // бросил регистрацию и начал заново — пароль новый, подтверждения всё ещё нет
  res = await call(null, 'POST', '/api/wed/register', { email, password: pass2, accept: true });
  check('незаконченная регистрация повторяется', res.status === 200, res.text);
  for (const x of (await call(SU, 'GET', `/api/collections/signatures/records?filter=${encodeURIComponent(`vendor = "${v?.id}"`)}`)).json?.items ?? []) {
    if (!cleanup.signatures.includes(x.id)) cleanup.signatures.unshift(x.id);
  }

  let o = await code(v?.id);
  check('тестовый код заведён', !!o.otpId, o.raw.text);
  res = await call(null, 'POST', '/api/wed/confirm', { otpId: o.otpId, code: '000000' });
  check('неверный код почту не подтверждает', res.status === 400, res.text);
  res = await call(null, 'POST', '/api/wed/confirm', { otpId: o.otpId, code: o.code });
  check('код подтверждает почту и пускает', res.status === 200 && !!res.json?.token && res.json.record?.verified === true, res.text);
  res = await login(pass2);
  check('после подтверждения — вход паролем', res.status === 200 && res.json.record?.id === v?.id, res.text);
  res = await call(null, 'POST', '/api/wed/register', { email, password: pass1, accept: true });
  check('вторую учётку на ту же почту не завести', res.status === 400, res.text);

  o = await code(v?.id);
  res = await call(null, 'POST', '/api/wed/password-reset', { otpId: o.otpId, code: '000000', password: pass1 });
  check('чужой код пароль не меняет', res.status === 400, res.text);
  res = await call(null, 'POST', '/api/wed/password-reset', { otpId: o.otpId, code: o.code, password: '123' });
  check('короткий новый пароль не принимается', res.status === 400, res.text);
  res = await call(null, 'POST', '/api/wed/password-reset', { otpId: o.otpId, code: o.code, password: pass1 });
  check('новый пароль по коду и сразу вход', res.status === 200 && !!res.json?.token, res.text);
  res = await call(null, 'POST', '/api/wed/password-reset', { otpId: o.otpId, code: o.code, password: pass2 });
  check('код сброса одноразовый', res.status === 400, res.text);
  check('старый пароль больше не подходит', refused(await login(pass2)));
  check('новый пароль подходит', (await login(pass1)).status === 200);
}

// ---------- уборка ----------
for (const [col, ids] of Object.entries(cleanup)) {
  for (const id of ids.filter(Boolean)) await call(SU, 'DELETE', `/api/collections/${col}/records/${id}`);
}

console.log(`\n${passed} прошло, ${failures.length} не прошло`);
if (failures.length) process.exit(1);
