// ДЕМО-РЕЖИМ КАБИНЕТА — ТОЛЬКО ДЕВ-СЕРВЕР (05.11.2026).
// Никита смотрит анкету, «Мои карточки» и «Профиль» без входа: открыть
// любой экран кабинета с ?demo — подставляется учётка «Анна Дремина» и три
// выдуманные карточки, все запросы к базе отвечает этот модуль, в памяти
// вкладки (sessionStorage). В живую базу ничего не уходит. Выйти — ?demo=0.
// В сборку сайта модуль не попадает: cabinet-api.ts зовёт его только под
// import.meta.env.DEV, и Vite выбрасывает эту ветку из боевого кода.
import { ApiError } from './cabinet-api';

const KEY = 'wed-cab-demo-state-2'; // -2: «Описание» Анны пустое — видно пример-плейсхолдер (05.11)

interface State { vendor: any; revisions: any[]; cards: any[]; others?: any[]; seq: number }

const now = () => new Date().toISOString().replace('T', ' ');
/** «N минут назад» — для сроков модерации в демо */
const ago = (min: number) => new Date(Date.now() - min * 60000).toISOString().replace('T', ' ');

function seed(): State {
  const vendor = { id: 'demo-vendor', collectionId: 'demo', name: 'Анна Дремина', email: 'anna@example.ru', telegramId: '100', maxId: '', notify: {} };
  const base = { collectionId: 'demo', owner: vendor.id, created: now(), updated: now(), venue: '', specialist: '', avatar: '', cover: '', rejectReason: '' };
  return {
    vendor,
    seq: 10,
    revisions: [
      {
        ...base, id: 'demo-r1', kind: 'specialist', categorySlug: 'fotografy', slug: 'anna-dremina', status: 'draft',
        photos: ['demo-1.jpg', 'demo-2.jpg', 'demo-3.jpg'],
        data: {
          name: 'Анна Дремина', firstName: 'Анна', lastName: 'Дремина', tagline: 'Репортаж без постановки',
          sections: [], // пусто: в «Описании» виден серый пример под категорию
          contacts: { phone: '+7900123', phoneCountry: 'RU' }, filters: {},
        },
      },
      {
        ...base, id: 'demo-r2', kind: 'venue', categorySlug: '', slug: 'forest-hall', status: 'rejected',
        rejectReason: 'На двух кадрах чужой логотип — уберите их или загрузите без знака',
        photos: ['demo-4.jpg', 'demo-5.jpg', 'demo-6.jpg', 'demo-7.jpg', 'demo-8.jpg', 'demo-9.jpg', 'demo-10.jpg', 'demo-11.jpg'],
        data: { name: 'Forest Hall', address: 'Москва, Лесная, 5', halls: [{ name: 'Большой зал', banquet: 120, buffet: 200 }], terms: { kitchen: 'own', alcohol: 'fee' }, contacts: { phone: '+79001234567', phoneCountry: 'RU' }, sections: [{ title: '', body: 'Лофт в зелени на берегу пруда. Панорамные окна, своя кухня, летняя терраса на двести гостей и отдельная комната для сборов невесты.' }] },
      },
      // площадка «ведём мы» (09.11): анкета как у venue-forms — строки и тарифы залов
      {
        ...base, id: 'demo-r3', kind: 'venue', categorySlug: '', slug: 'grebnevo', status: 'draft', venue: 'demo-v3', photos: [],
        data: {
          managed: true, name: 'Усадьба Гребнево', address: 'Московская область, Фрязино, Гребнево', type: 'usadba', checkFrom: 7000, capacityBanquet: 350,
          rows: [
            { at: 'meta.3', group: 'Характеристики', label: 'Кухня', value: 'ресторан усадьбы, меню от 7 000 ₽ на персону' },
            { at: 'blocks.4.terms.0.rows.0', group: 'Меню и сборы', label: 'Минимальный заказ по меню', value: 'от 7 000 ₽ на персону' },
            { at: 'blocks.4.terms.0.rows.2', group: 'Меню и сборы', label: 'Свой алкоголь и напитки', value: 'можно, пробковый сбор 500 ₽ с человека' },
          ],
          hallTariffs: [{ id: 'trubetskoy-hall', name: 'Трубецкой Холл', tariff: [{ day: 'Пн–Чт', rent: '80 000 ₽', deposit: '220 000 ₽' }, { day: 'Пятница', rent: '120 000 ₽', deposit: '300 000 ₽' }] }],
          contacts: { phone: '+79001234567', phoneCountry: 'RU' },
        },
      },
    ],
    cards: [{ id: 'demo-c1', kind: 'specialist', categorySlug: 'vedushchie', name: 'Go Show', status: 'published', revision: null }],
    // для админки: заявки и правки других подрядчиков (owner раскрыт, как expand=owner)
    others: [
      { ...base, id: 'demo-a1', owner: 'v2', expand: { owner: { name: 'Мария Котова' } }, kind: 'specialist', categorySlug: 'dekoratory', slug: 'kotova', status: 'review', submittedAt: ago(20 * 60), photos: ['d-1.jpg', 'd-2.jpg', 'd-3.jpg', 'd-4.jpg', 'd-5.jpg', 'd-6.jpg', 'd-7.jpg', 'd-8.jpg'], data: { name: 'Мария Котова', tagline: 'Декор в природных оттенках', sections: [{ title: '', body: 'Оформляю свадьбы в загородных площадках: арки, столы, флористика. Работаю с живыми цветами и тканями.' }], contacts: { phone: '+79001112233' }, priceFrom: 60000, priceNote: 'за проект' } },
      { ...base, id: 'demo-a2', owner: 'v3', expand: { owner: { name: 'Лофт «Причал»' } }, kind: 'venue', categorySlug: '', slug: 'prichal', status: 'review', submittedAt: ago(3 * 60), photos: [], data: { name: 'Лофт «Причал»', address: 'Москва, Береговой проезд, 5' } },
      { ...base, id: 'demo-a3', owner: 'v4', expand: { owner: { name: 'Илья Громов' } }, kind: 'specialist', categorySlug: 'vedushchie', slug: '', status: 'draft', photos: ['d-9.jpg'], data: { name: 'Илья Громов' }, updated: ago(26 * 60) },
      { ...base, id: 'demo-a4', owner: 'v5', expand: { owner: { name: 'Студия «Кадр»' } }, kind: 'specialist', categorySlug: 'videografy', slug: 'kadr', status: 'rejected', rejectReason: 'Мало фото — нужно от 8', photos: ['d-10.jpg'], data: { name: 'Студия «Кадр»' } },
      { ...base, id: 'demo-a5', owner: 'v6', expand: { owner: { name: 'Go Show' } }, kind: 'specialist', categorySlug: 'vedushchie', slug: 'go-show', specialist: 'demo-c1', status: 'review', submittedAt: ago(5 * 60), photos: [], data: { name: 'Go Show', priceFrom: 45000, priceNote: 'за вечер' } },
      { ...base, id: 'demo-a6', owner: 'v7', expand: { owner: { name: 'Ресторан «Сад»' } }, kind: 'venue', categorySlug: '', slug: 'sad', venue: 'demo-v1', status: 'approved', reviewedAt: ago(48 * 60), photos: [], data: { name: 'Ресторан «Сад»' } },
    ],
  };
}

function load(): State {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  const s = seed();
  save(s);
  return s;
}
function save(s: State) {
  try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}

/** включён ли демо: ?demo в адресе включает, ?demo=0 выключает; помним до закрытия вкладки */
export function demoOn(): boolean {
  try {
    const q = new URLSearchParams(location.search);
    if (q.get('demo') === '0') { sessionStorage.removeItem('wed-cab-demo'); sessionStorage.removeItem(KEY); localStorage.removeItem('wed-cab-vendor'); localStorage.removeItem('wed-cab-moderator'); return false; }
    if (q.has('demo')) {
      sessionStorage.setItem('wed-cab-demo', '1');
      localStorage.setItem('wed-cab-vendor', JSON.stringify({ token: 'demo', record: load().vendor }));
      localStorage.setItem('wed-cab-moderator', JSON.stringify({ token: 'demo', record: { id: 'demo-mod', name: 'Никита', email: 'mod@example.ru' } }));
    }
    return sessionStorage.getItem('wed-cab-demo') === '1';
  } catch {
    return false;
  }
}

/** картинка-заглушка для демо-кадра: мягкий градиент, свой оттенок у каждого */
// (заглушка кадров — demoPic в cabinet-api.ts, синхронно)
export function demoImage(name: string): string {
  const h = [...name].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 500'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='hsl(${h},35%,78%)'/><stop offset='1' stop-color='hsl(${(h + 40) % 360},30%,62%)'/></linearGradient></defs><rect width='400' height='500' fill='url(#g)'/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms));

export async function demoApi(method: string, path: string, body?: unknown): Promise<any> {
  await wait();
  const s = load();
  const url = new URL(path, 'http://demo');
  const p = url.pathname;
  const done = (v: any) => { save(s); return structuredClone(v); };
  const revById = (id: string) => {
    const r = s.revisions.find((x) => x.id === id) ?? (s.others ?? []).find((x) => x.id === id);
    if (!r) throw new ApiError(404, 'Не нашли — возможно, это уже удалили. Обновите страницу');
    return r;
  };

  if (p === '/api/files/token') return { token: 'demo' };
  if (p === '/api/wed/my-cards') return done({ items: s.cards });
  if (p.startsWith('/api/collections/legal_docs/')) return { items: [{ kind: 'vendor-offer', title: 'Оферта для подрядчиков (демо)', text: '<p>Текст оферты появится здесь.</p>' }] };
  if (p === '/api/wed/slug') return { suggestion: 'demo-' + s.seq };
  if (p === '/api/wed/preview-link') throw new ApiError(400, 'В демо-режиме превью нет — оно открывается на настоящей карточке');
  // Яндекс Диск в демо: в ссылке «video» — папка только с роликами, «obryv» — связь рвётся на второй пачке
  if (p === '/api/wed/yadisk/list') {
    const link = url.searchParams.get('url') ?? '';
    if (/video/i.test(link)) return { title: 'Ролики со свадьбы', items: [], videos: 3, capped: false };
    const items = Array.from({ length: 14 }, (_, i) => ({ path: `/kadr-${i + 1}.jpg`, name: `kadr-${i + 1}.jpg`, preview: demoImage(`yd-${i}`), size: 3_000_000 }));
    return { title: 'Свадьба Анны и Ильи', items, videos: 2, capped: false };
  }
  if (p === '/api/wed/yadisk/import') {
    const b = body as any;
    const r = revById(b.revision);
    s.seq++;
    if (/obryv/i.test(b.url) && (s as any).ydBatches === 1) { (s as any).ydBatches = 0; save(s); throw new ApiError(0, 'Нет связи с сервером. Проверьте интернет и повторите'); }
    (s as any).ydBatches = ((s as any).ydBatches ?? 0) + 1;
    await wait(900);
    const names = b.paths.map((x: string) => `demo-yd-${x.replace(/\W/g, '')}-${s.seq}.jpg`);
    r.photos = [...(r.photos ?? []), ...names];
    return done({ record: r, added: names.length, already: 0, skipped: [] });
  }

  if (p === '/api/wed/edit') {
    const b = body as any;
    const card = s.cards.find((c) => c.id === b.card);
    const r = { ...structuredClone(s.revisions[0]), id: `demo-r${++s.seq}`, kind: b.kind, status: 'draft', specialist: b.kind === 'specialist' ? b.card : '', venue: b.kind === 'venue' ? b.card : '', data: { name: card?.name ?? 'Карточка' }, photos: [] };
    s.revisions.push(r);
    if (card) card.revision = r;
    return done(r);
  }

  if (p.startsWith('/api/collections/vendors/records/')) {
    if (method === 'PATCH') Object.assign(s.vendor, body);
    return done(s.vendor);
  }

  // админка: все ревизии (свои демо + других подрядчиков), с раскрытым владельцем
  const all = () => [...s.revisions.map((r) => ({ ...r, expand: r.expand ?? { owner: { name: s.vendor.name } } })), ...(s.others ?? [])];
  if (p === '/api/collections/revisions/records' && method === 'GET' && !(url.searchParams.get('filter') ?? '').includes('venue = ""')) {
    return done({ items: all() });
  }
  if (p === '/api/collections/specialists/records' || p === '/api/collections/venues/records') {
    const kind = p.includes('specialists') ? 'specialist' : 'venue';
    return done({ items: kind === 'specialist' ? [{ id: 'demo-c1', collectionId: 'demo', name: 'Go Show', slug: 'go-show', categorySlug: 'vedushchie', status: 'published', owner: 'v6' }] : [] });
  }
  if (p === '/api/wed/mod/remove') return done({ ok: true });

  if (p === '/api/collections/revisions/records') {
    if (method === 'POST') {
      const b = body as any;
      const r = { collectionId: 'demo', id: `demo-r${++s.seq}`, owner: s.vendor.id, kind: b.kind, categorySlug: b.categorySlug ?? '', status: 'draft', data: {}, photos: [], slug: '', venue: '', specialist: '', created: now(), updated: now() };
      s.revisions.push(r);
      return done(r);
    }
    const f = url.searchParams.get('filter') ?? '';
    return done({ items: s.revisions.filter((r) => (f.includes('venue = ""') ? !r.venue && !r.specialist && r.status !== 'approved' : true)) });
  }

  const m = p.match(/^\/api\/collections\/revisions\/records\/([^/]+)$/);
  if (m) {
    const r = revById(decodeURIComponent(m[1]));
    if (method === 'GET') return done(r);
    if (method === 'DELETE') { s.revisions = s.revisions.filter((x) => x !== r); return done(null); }
    if (method === 'PATCH') {
      if (body instanceof FormData) {
        const files = body.getAll('photos+');
        r.photos = [...(r.photos ?? []), ...files.map(() => `demo-${++s.seq}.jpg`)];
        if (body.get('avatar')) r.avatar = `demo-ava-${++s.seq}.jpg`;
      } else {
        const b = { ...(body as any) };
        if (b['photos-']) { r.photos = (r.photos ?? []).filter((n: string) => !b['photos-'].includes(n)); delete b['photos-']; }
        Object.assign(r, b);
        if (b.status === 'review') r.submittedAt = now();
      }
      r.updated = now();
      return done(r);
    }
  }
  throw new ApiError(400, 'В демо-режиме это действие недоступно');
}
