// ТОЧКА ПЛОЩАДКИ В АНКЕТЕ (решение Никиты 09.11.2026, docs/MAPS-SETUP.md).
//
// Бесплатный тариф Яндекса запрещает хранить ответ API (координаты геокодера,
// карточку организации). Хранить можно то, что дал сам пользователь. Поэтому:
//   1. по ссылке на Карты (если в ней есть точка) или по адресу ставим
//      ПРЕДВАРИТЕЛЬНУЮ метку — геокодер JS API, показ на карте Яндекса;
//   2. подрядчик подтверждает её («Точка верная»), перетаскивает или нажимает
//      на карте нужное место — и только эта точка уходит в анкету (contacts.geo).
// Ссылку на организацию сервером не разбираем и страницы Карт не парсим.
//
// Скрипт Яндекса грузится лениво, когда раздел с картой открыт.

export type Geo = { lat: number; lon: number };

/** Москва и область с запасом: точка вне рамки — опечатка или не наш регион.
 *  Та же рамка — в хуке базы (pb_hooks/lib/cabinet.js, geoOf). */
export const GEO_BOX = { latMin: 54.0, latMax: 57.5, lonMin: 35.0, lonMax: 40.5 };

export function inBox(g: Partial<Geo> | null | undefined): g is Geo {
  if (!g) return false;
  const { lat, lon } = g as Geo;
  return Number.isFinite(lat) && Number.isFinite(lon)
    && lat >= GEO_BOX.latMin && lat <= GEO_BOX.latMax && lon >= GEO_BOX.lonMin && lon <= GEO_BOX.lonMax;
}

const round = (n: number) => Math.round(n * 1e6) / 1e6;

/**
 * Точка из самой ссылки, которую вставил человек: у ссылки из адресной строки
 * Карт бывает ll=, pt= или whatshere[point]= (долгота,широта). Короткую ссылку
 * «Поделиться» (/maps/-/…) так не разобрать — тогда метка по адресу.
 */
export function coordsFromLink(link: string): Geo | null {
  let u: URL;
  try { u = new URL(link.trim()); } catch { return null; }
  const raw = u.searchParams.get('whatshere[point]') || u.searchParams.get('pt') || u.searchParams.get('ll') || '';
  const [lon, lat] = raw.split(',').map(Number);
  const g = { lat: round(lat), lon: round(lon) };
  return inBox(g) ? g : null;
}

let apiPromise: Promise<any> | null = null;
function loadYmaps(key: string): Promise<any> {
  if (!apiPromise) {
    apiPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(key)}&lang=ru_RU`;
      s.onload = () => (window as any).ymaps.ready(() => resolve((window as any).ymaps));
      s.onerror = () => { apiPromise = null; reject(new Error('ymaps')); };
      document.head.appendChild(s);
    });
  }
  return apiPromise;
}

type Opts = {
  root: HTMLElement;
  apiKey: string;
  /** подтверждённая точка из анкеты */
  value: Geo | null;
  address: () => string;
  link: () => string;
  /** подрядчик подтвердил или сам поставил точку */
  onChange: (g: Geo) => void;
  readOnly?: boolean;
};

const NOTE = {
  empty: 'Введите адрес — поставим метку, а вы проверите. Или нажмите на карте место площадки',
  suggest: 'Проверьте метку. Не там — перетащите её или нажмите на карте нужное место',
  saved: 'Точка стоит. Чтобы поправить, перетащите метку или нажмите на карте',
  notFound: 'Не нашли адрес на карте. Нажмите на карте место площадки',
  fail: 'Карта не загрузилась. Обновите страницу',
};

export function mountGeoPick(o: Opts) {
  const canvas = o.root.querySelector<HTMLElement>('[data-geo-map]')!;
  const note = o.root.querySelector<HTMLElement>('[data-geo-note]')!;
  const okBtn = o.root.querySelector<HTMLButtonElement>('[data-geo-ok]')!;
  const againBtn = o.root.querySelector<HTMLButtonElement>('[data-geo-again]')!;

  let map: any = null;
  let mark: any = null;
  let saved: Geo | null = inBox(o.value) ? o.value : null;
  let lastQuery = '';

  const state = (k: keyof typeof NOTE) => {
    note.textContent = NOTE[k];
    okBtn.hidden = k !== 'suggest' || !!o.readOnly;
    againBtn.hidden = k !== 'saved' || !!o.readOnly || !(o.address().trim() || o.link().trim());
  };

  const confirm = (g: Geo) => {
    saved = { lat: round(g.lat), lon: round(g.lon) };
    o.onChange(saved);
    state('saved');
  };

  const place = (g: Geo, zoom = 16) => {
    if (!map) return;
    if (!mark) {
      mark = new (window as any).ymaps.Placemark([g.lat, g.lon], {}, { draggable: !o.readOnly, preset: 'islands#blackDotIcon' });
      // перетащил сам — это его точка, сохраняем сразу
      mark.events.add('dragend', () => {
        const [lat, lon] = mark.geometry.getCoordinates();
        confirm({ lat, lon });
      });
      map.geoObjects.add(mark);
    } else mark.geometry.setCoordinates([g.lat, g.lon]);
    map.setCenter([g.lat, g.lon], zoom);
  };

  /** предварительная метка по ссылке или адресу; ничего не сохраняет */
  async function suggest(force = false) {
    if (!map || o.readOnly) return;
    if (saved && !force) return;
    const link = o.link().trim();
    const addr = o.address().trim();
    const query = `${link}|${addr}`;
    if (!force && query === lastQuery) return;
    lastQuery = query;
    const fromLink = link ? coordsFromLink(link) : null;
    if (fromLink) { place(fromLink); state('suggest'); return; }
    if (addr.length < 5) { if (!saved) state('empty'); return; }
    try {
      const ymaps = (window as any).ymaps;
      const res = await ymaps.geocode(addr, {
        results: 1,
        // ищем в Москве и области, а не по всей стране
        boundedBy: [[GEO_BOX.latMin, GEO_BOX.lonMin], [GEO_BOX.latMax, GEO_BOX.lonMax]],
        strictBounds: true,
      });
      const first = res.geoObjects.get(0);
      if (!first) { state('notFound'); return; }
      const [lat, lon] = first.geometry.getCoordinates();
      place({ lat, lon }, first.properties.get('metaDataProperty.GeocoderMetaData.precision') === 'exact' ? 16 : 13);
      state('suggest');
    } catch {
      state('notFound');
    }
  }

  okBtn.addEventListener('click', () => {
    if (!mark) return;
    const [lat, lon] = mark.geometry.getCoordinates();
    confirm({ lat, lon });
  });
  againBtn.addEventListener('click', () => suggest(true));

  // карта просыпается, когда видна (раздел мог открыться прокруткой)
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    loadYmaps(o.apiKey).then((ymaps) => {
      map = new ymaps.Map(canvas, { center: [55.75, 37.62], zoom: 9, controls: ['zoomControl'] }, { suppressMapOpenBlock: false });
      // скролл страницы колесом не должен крутить карту
      map.behaviors.disable('scrollZoom');
      if (!o.readOnly) {
        map.events.add('click', (e: any) => {
          const [lat, lon] = e.get('coords');
          place({ lat, lon }, map.getZoom());
          confirm({ lat, lon });
        });
      }
      if (saved) { place(saved); state('saved'); } else { state('empty'); suggest(); }
    }).catch(() => state('fail'));
  });
  io.observe(canvas);

  return {
    /** адрес или ссылка поменялись — новая предварительная метка (если точку ещё не подтвердили) */
    refresh: () => suggest(false),
  };
}
