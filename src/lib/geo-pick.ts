// ТОЧКА ПЛОЩАДКИ В АНКЕТЕ (решение Никиты 09.11.2026, docs/MAPS-SETUP.md).
//
// Как работает (второй вариант, Никита 09.11 после живой пробы):
//   1. подрядчик вводит адрес — под полем подсказки Яндекса (Геосаджест);
//   2. выбрал подсказку — на карте метка по этому адресу (геокодер JS API);
//   3. метка не там — перетаскивает её; «Точка верная» — подтверждает.
// В анкету (contacts.geo) уходит только точка, которую подрядчик подтвердил
// или передвинул сам: бесплатный тариф Яндекса запрещает хранить ответ API.
//
// Чего нет и почему:
//   - точки по ссылке на Карты: из ссылки «Поделиться» (/maps/-/…) координат
//     не достать, а страницу Карт мы не разбираем;
//   - касания карты, которое ставит точку: на телефоне палец, листающий анкету,
//     случайно ставил и сохранял точку (проба 09.11, метка в лесу).
//
// Скрипт Яндекса грузится лениво: при первом вводе адреса или когда карта видна.

export type Geo = { lat: number; lon: number };

/** Москва и область с запасом: точка вне рамки — опечатка или не наш регион.
 *  Та же рамка — в хуке базы (pb_hooks/lib/cabinet.js, geoOf). */
export const GEO_BOX = { latMin: 54.0, latMax: 57.5, lonMin: 35.0, lonMax: 40.5 };
const BOUNDS: [[number, number], [number, number]] = [[GEO_BOX.latMin, GEO_BOX.lonMin], [GEO_BOX.latMax, GEO_BOX.lonMax]];

export function inBox(g: Partial<Geo> | null | undefined): g is Geo {
  if (!g) return false;
  const { lat, lon } = g as Geo;
  return Number.isFinite(lat) && Number.isFinite(lon)
    && lat >= GEO_BOX.latMin && lat <= GEO_BOX.latMax && lon >= GEO_BOX.lonMin && lon <= GEO_BOX.lonMax;
}

const round = (n: number) => Math.round(n * 1e6) / 1e6;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

let apiPromise: Promise<any> | null = null;
function loadYmaps(key: string): Promise<any> {
  if (!apiPromise) {
    apiPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      const k = encodeURIComponent(key);
      // suggest_apikey — подсказкам нужен ключ отдельным параметром (у нас один ключ на все продукты)
      s.src = `https://api-maps.yandex.ru/2.1/?apikey=${k}&suggest_apikey=${k}&lang=ru_RU`;
      s.onload = () => (window as any).ymaps.ready(() => resolve((window as any).ymaps));
      s.onerror = () => { apiPromise = null; reject(new Error('ymaps')); };
      document.head.appendChild(s);
    });
  }
  return apiPromise;
}

type Opts = {
  root: HTMLElement;
  /** поле «Адрес» анкеты — под ним подсказки */
  input: HTMLInputElement;
  apiKey: string;
  /** подтверждённая точка из анкеты */
  value: Geo | null;
  /** подрядчик подтвердил или передвинул точку */
  onChange: (g: Geo) => void;
  readOnly?: boolean;
};

const NOTE = {
  empty: 'Начните вводить адрес и выберите его из подсказок — покажем точку на карте',
  suggest: 'Проверьте метку. Не там — перетащите её на вход площадки',
  saved: 'Точка стоит. Не там — перетащите метку',
  notFound: 'Не нашли адрес на карте. Выберите его из подсказок',
  fail: 'Карта не загрузилась. Обновите страницу',
};

export function mountGeoPick(o: Opts) {
  const canvas = o.root.querySelector<HTMLElement>('[data-geo-map]')!;
  const note = o.root.querySelector<HTMLElement>('[data-geo-note]')!;
  const okBtn = o.root.querySelector<HTMLButtonElement>('[data-geo-ok]')!;

  let map: any = null;
  let mark: any = null;
  let saved: Geo | null = inBox(o.value) ? o.value : null;
  let pending: Geo | null = null;

  const state = (k: keyof typeof NOTE) => {
    note.textContent = NOTE[k];
    okBtn.hidden = k !== 'suggest' || !!o.readOnly;
    // карту показываем, когда есть что на ней показать
    canvas.hidden = k === 'empty' || k === 'notFound';
    if (!canvas.hidden) map?.container.fitToViewport();
  };

  const confirm = (g: Geo) => {
    saved = { lat: round(g.lat), lon: round(g.lon) };
    pending = null;
    o.onChange(saved);
    state('saved');
  };

  async function ensureMap() {
    if (map) return map;
    const ymaps = await loadYmaps(o.apiKey);
    if (map) return map;
    canvas.hidden = false;
    map = new ymaps.Map(canvas, { center: [55.75, 37.62], zoom: 9, controls: ['zoomControl'] });
    // карта не перехватывает прокрутку анкеты: колесо и один палец листают страницу
    // (на ПК мышью карту двигать можно — прокрутке это не мешает)
    map.behaviors.disable(matchMedia('(pointer: fine)').matches ? ['scrollZoom'] : ['scrollZoom', 'drag']);
    map.behaviors.enable('multiTouch');
    return map;
  }

  async function place(g: Geo, zoom = 17) {
    const m = await ensureMap();
    if (!mark) {
      mark = new (window as any).ymaps.Placemark([g.lat, g.lon], {}, { draggable: !o.readOnly, preset: 'islands#redDotIcon' });
      // перетащил сам — это его точка, сохраняем сразу
      mark.events.add('dragend', () => {
        const [lat, lon] = mark.geometry.getCoordinates();
        confirm({ lat, lon });
      });
      m.geoObjects.add(mark);
    } else mark.geometry.setCoordinates([g.lat, g.lon]);
    m.setCenter([g.lat, g.lon], zoom);
  }

  /** метка по выбранному адресу — предварительная, в анкету не пишется */
  async function showAddress(addr: string) {
    try {
      await ensureMap();
      const res = await (window as any).ymaps.geocode(addr, { results: 1, boundedBy: BOUNDS, strictBounds: true });
      const first = res.geoObjects.get(0);
      if (!first) { state('notFound'); return; }
      const [lat, lon] = first.geometry.getCoordinates();
      const exact = first.properties.get('metaDataProperty.GeocoderMetaData.precision') === 'exact';
      pending = { lat, lon };
      state('suggest');
      await place(pending, exact ? 17 : 14);
    } catch {
      state('fail');
    }
  }

  // ---------- подсказки под полем адреса ----------
  const list = document.createElement('div');
  list.className = 'c-suggest';
  list.setAttribute('role', 'listbox');
  list.hidden = true;
  o.input.closest('.a-field')!.appendChild(list);
  o.input.setAttribute('autocomplete', 'off');

  let timer = 0;
  let seq = 0;
  const hide = () => { list.hidden = true; list.innerHTML = ''; };

  async function suggest() {
    const text = o.input.value.trim();
    if (text.length < 3) { hide(); return; }
    const my = ++seq;
    try {
      const ymaps = await loadYmaps(o.apiKey);
      const items: { displayName: string; value: string }[] = await ymaps.suggest(text, { results: 5, boundedBy: BOUNDS, strictBounds: true });
      if (my !== seq) return;
      if (!items.length) { hide(); return; }
      list.innerHTML = items.map((it, i) => `<button type="button" class="c-suggest__item" role="option" data-i="${i}">${esc(it.displayName)}</button>`).join('');
      list.hidden = false;
      list.querySelectorAll<HTMLButtonElement>('[data-i]').forEach((b) => {
        // pointerdown, а не click: иначе поле теряет фокус и список прячется раньше нажатия
        b.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          const it = items[Number(b.dataset.i)];
          o.input.value = it.value.replace(/,\s*$/, '');
          // анкета сохраняет поле по событию input (setPath в kartochka.astro)
          o.input.dispatchEvent(new Event('input', { bubbles: true }));
          hide();
          o.input.blur();
          showAddress(o.input.value);
        });
      });
    } catch {
      hide();
    }
  }

  if (!o.readOnly) {
    o.input.addEventListener('input', (e) => {
      if (!e.isTrusted) return; // своё событие после выбора подсказки
      clearTimeout(timer);
      timer = window.setTimeout(suggest, 250);
    });
    o.input.addEventListener('blur', () => window.setTimeout(hide, 150));
    o.input.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
  }

  okBtn.addEventListener('click', () => { if (pending || mark) confirm(pending ?? (() => { const [lat, lon] = mark.geometry.getCoordinates(); return { lat, lon }; })()); });

  // стартовое состояние: точка уже есть — карта с ней; адрес есть, точки нет —
  // метка по адресу на проверку; ничего нет — подсказка, карта спрятана
  const whenVisible = (fn: () => void) => {
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      fn();
    });
    io.observe(o.root);
  };
  state('empty');
  if (saved) whenVisible(() => { state('saved'); place(saved!).catch(() => state('fail')); });
  else if (!o.readOnly && o.input.value.trim().length >= 5) whenVisible(() => showAddress(o.input.value));
}
