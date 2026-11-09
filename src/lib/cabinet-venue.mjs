// Площадка из кабинета → страница площадки сайта (тип Venue, см. data/venues.ts).
// Тело `page` собирает база (pb_hooks/lib/cabinet.js, buildPage) при одобрении
// и для превью; здесь — второй шаг, общий для сайта из базы (lib/live-data.ts)
// и превью (/profi/prevyu/). Пара к lib/cabinet-card.mjs у подрядчиков:
// один модуль на двоих, чтобы превью не разошлось с настоящей страницей.
//
// Своих разделов не досочиняем: страница — то, что площадка сама написала
// в анкете (Основное, Залы, Условия, Описание, Вопросы), блоками VenueBlock.
// Зал с фото (выбраны в анкете из загруженных, 08.11) — секцией блока `halls`,
// как у площадок конвейера; зал без фото — пунктом рассказа.
// Чистый .mjs без зависимостей.

import { storyOf } from './cabinet-card.mjs';

const NBSP = ' ';
const num = (n) => Number(n).toLocaleString('ru-RU').replace(/\s/g, NBSP);
const rub = (n) => `${num(n)}${NBSP}₽`;
const int = (v) => {
  const n = Number(String(v ?? '').replace(/\s/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
};
const str = (v) => String(v ?? '').trim();

/** подписи ответов — те же, что в анкете (lib/cabinet-form.ts, VENUE_QUESTIONS / VENUE_TERMS) */
const TYPE_LABEL = {
  restoran: 'Ресторан', 'banketnyj-zal': 'Банкетный зал', shater: 'Шатёр', veranda: 'Веранда',
  'restoran-pri-otele': 'Ресторан при отеле', 'zagorodnyj-klub': 'Загородный клуб', loft: 'Лофт',
  oranzhereya: 'Оранжерея', usadba: 'Усадьба', 'yaht-klub': 'Яхт-клуб',
};
const KITCHEN = { own: 'Только своя', catering: 'Можно свой кейтеринг', both: 'Своя или ваш кейтеринг' };
const ALCOHOL = { free: 'Можно, без сбора', fee: 'Можно, со сбором', no: 'Нельзя' };

/** залы анкеты: только с названием */
export function hallsOf(p) {
  return (Array.isArray(p.halls) ? p.halls : [])
    .map((h) => ({
      name: str(h?.name),
      banquet: int(h?.banquet),
      buffet: int(h?.buffet),
      area: int(h?.area),
      priceFrom: int(h?.priceFrom),
      note: str(h?.note),
      photos: Array.isArray(h?.photos) ? h.photos.map(String) : [],
    }))
    .filter((h) => h.name);
}

/** вместимость площадки: из Основного, а нет — самый большой зал */
function capacity(p, halls) {
  return {
    banquet: int(p.capacityBanquet) || Math.max(0, ...halls.map((h) => h.banquet)),
    buffet: int(p.capacityBuffet) || Math.max(0, ...halls.map((h) => h.buffet)),
  };
}

/**
 * Первый абзац рассказа — лид первого экрана. Абзац ПЕРЕНОСИТСЯ, а не
 * копируется: дважды подряд одна фраза на странице не стоит, и текст
 * площадки не теряется (сверка text-coverage). Нет текста — пусто.
 */
function takeLead(story) {
  for (let i = 0; i < story.length; i++) {
    const s = story[i];
    if (s.lead) {
      const { lead, ...rest } = s;
      story[i] = rest;
      return lead;
    }
    if (s.text?.length) {
      story[i] = { ...s, text: s.text.slice(1) };
      return s.text[0];
    }
  }
  return '';
}

/** раздел, в котором есть что показать */
const hasContent = (s) => !!(s.lead || s.text?.length || s.list?.length || s.after?.length || s.tariffs?.length || s.items?.length);

/** топоним для бирки: город или посёлок из адреса, без улицы и дома */
function placeOf(address) {
  const first = str(address).split(',')[0].trim();
  return first.length <= 22 ? first : '';
}

/**
 * page (форма buildPage, source: 'cabinet') + готовые пути кадров → Venue.
 * photos — уже в порядке показа: обложка первой (orderedPhotos).
 * fileOf(имя файла) → путь кадра для фото залов (имена в page.halls[].photos);
 * кадр, которого больше нет в карточке, отбрасывается.
 */
export function venueFromPage(p, { slug, name, photos, fileOf = () => undefined }) {
  const title = str(p.name) || str(name);
  const halls = hallsOf(p);
  const cap = capacity(p, halls);
  const rent = int(p.rentFrom);
  const check = int(p.checkFrom);
  const terms = p.terms && typeof p.terms === 'object' ? p.terms : {};
  const filters = p.filters && typeof p.filters === 'object' ? p.filters : {};
  const typeLabel = TYPE_LABEL[[].concat(filters.type ?? [])[0]] ?? 'Площадка';
  const address = str(p.address);
  const place = placeOf(address);

  // рассказ — разделами анкеты; тарифов у площадки нет, но storyOf их понимает
  const story = storyOf({ story: p.story, about: p.about, tariffs: p.tariffs });
  const told = story.filter(hasContent);
  const lead = takeLead(told);
  const rest = told.filter(hasContent);

  const stats = [
    cap.banquet && { value: num(cap.banquet), label: 'гостей на банкете' },
    cap.buffet && { value: num(cap.buffet), label: 'гостей на фуршете' },
    halls.length > 1 && { value: String(halls.length), label: halls.length < 5 ? 'зала' : 'залов' },
    rent && { value: rub(rent), label: 'аренда от' },
    check && { value: rub(check), label: 'чек на гостя от' },
  ].filter(Boolean).slice(0, 4);

  // гости и чек уже стоят крупными цифрами (stats) — в характеристиках их не
  // повторяем (Никита 08.11: «до 60 гостей» дважды подряд); чек — только если в цифры не влез
  const inStats = (label) => stats.some((x) => x.label === label);
  const meta = [
    { label: 'Тип', value: typeLabel },
    address && { label: 'Адрес', value: address },
    check && !inStats('чек на гостя от') && { label: 'Чек на гостя', value: `от ${rub(check)}` },
  ].filter(Boolean);

  // зал с фото — секция с кадром (блоки halls-index и halls, как у площадок
  // конвейера); зал без фото — пунктом списка (08.11)
  const withShots = halls.map((h) => ({ ...h, shots: h.photos.map(fileOf).filter(Boolean) }));
  const shown = withShots.filter((h) => h.shots.length);
  const listed = withShots.filter((h) => !h.shots.length);
  const venueHalls = shown.map((h, i) => ({
    id: String(i + 1),
    name: h.name,
    kicker: '',
    photos: h.shots,
    alt: `${title}, ${h.name} — фото зала`,
    areaM2: h.area,
    banquet: h.banquet,
    buffet: h.buffet,
    tariff: [],
    ...(h.priceFrom ? { price: rub(h.priceFrom) } : {}),
    included: [],
    body: h.note ? h.note.split(/\n\s*\n/).map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean) : [],
  }));

  const hallSection = listed.length && {
    title: shown.length ? 'Ещё залы' : listed.length === 1 ? 'Зал' : 'Залы',
    items: listed.map((h) => {
      const list = [
        h.banquet && `банкет до ${num(h.banquet)} гостей`,
        h.buffet && `фуршет до ${num(h.buffet)} гостей`,
        h.area && `${num(h.area)}${NBSP}м²`,
        h.priceFrom && `аренда или депозит от ${rub(h.priceFrom)}`,
      ].filter(Boolean);
      return { title: h.name, ...(h.note ? { text: [h.note] } : {}), ...(list.length ? { list } : {}) };
    }),
  };

  const termRows = [
    rent && { label: 'Аренда', value: `от ${rub(rent)} за день` },
    check && { label: 'Средний чек', value: `от ${rub(check)} на гостя` },
    KITCHEN[terms.kitchen] && { label: 'Кухня', value: KITCHEN[terms.kitchen] },
    ALCOHOL[terms.alcohol] && { label: 'Свой алкоголь', value: ALCOHOL[terms.alcohol] },
    str(terms.until) && { label: 'До скольки', value: str(terms.until) },
    str(terms.parking) && { label: 'Парковка', value: str(terms.parking) },
  ].filter(Boolean);
  const more = str(terms.more).split(/\n\s*\n/).map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean);

  /** @type {any[]} */
  const blocks = [];
  if (stats.length) blocks.push({ type: 'stats', items: stats });
  if (rest.length) blocks.push({ type: 'story', sections: rest });
  if (venueHalls.length > 1) blocks.push({ type: 'halls-index', title: 'Залы' });
  if (venueHalls.length) blocks.push({ type: 'halls' });
  if (hallSection) blocks.push({ type: 'story', sections: [hallSection] });
  if (termRows.length) {
    blocks.push({
      type: 'terms',
      title: 'Условия',
      terms: [{ title: 'Коротко', rows: termRows }],
      included: [],
      extras: [],
    });
  }
  if (more.length) blocks.push({ type: 'story', sections: [{ title: 'Что ещё важно знать', text: more }] });
  blocks.push({ type: 'reels', title: 'Видео' }, { type: 'reviews' });

  const hero = photos[0];
  const alt = `${title} — фото площадки`;

  return {
    slug,
    citySlug: 'moskva',
    city: 'Москва и область',
    category: 'Площадки',
    categorySlug: 'ploshchadki',
    name: title,
    kicker: place ? `${typeLabel} · ${place}` : typeLabel,
    title,
    lead,
    hero: { image: hero, alt, portrait: photos[1] ?? hero, portraitAlt: alt },
    meta,
    stats,
    blocks,
    ...(venueHalls.length ? { halls: venueHalls } : {}),
    scenes: [],
    terms: [{ title: 'Коротко', rows: termRows }],
    included: [],
    extras: [],
    rules: [],
    // первый кадр — герой, лента первого экрана берёт остальные
    gallery: photos.slice(1).map((src) => ({ src, alt })),
    faq: [],
    contacts: {
      // контактов площадки на странице нет — заявка идёт через нас (VenueContacts)
      address,
      addressNote: '',
      phone: '',
      phoneHref: '',
      email: '',
      hours: '',
      routes: [],
      links: [],
      // точка, которую подрядчик поставил в анкете (хук geoOf): по ней площадка встаёт на карту каталога
      ...(p.geo && Number.isFinite(p.geo.lat) && Number.isFinite(p.geo.lon) ? { geo: { lat: p.geo.lat, lon: p.geo.lon } } : {}),
    },
    seo: {
      title: `${title} — свадебная площадка${place ? `, ${place}` : ''} | WED Secrets`,
      description: [
        `${typeLabel} для свадьбы${address ? ` — ${address}` : ''}.`,
        cap.banquet ? `Банкет до ${cap.banquet} гостей.` : '',
        check ? `Чек от ${num(check)} ₽ на гостя.` : '',
        'Фото, залы и условия на WED Secrets.',
      ].filter(Boolean).join(' '),
      ogImage: hero,
    },
  };
}
