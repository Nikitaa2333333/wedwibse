// ЗАЯВКИ ПАР В АДМИНКЕ (07.11.2026, docs/cabinet/LEADS-ADMIN.md) — один
// загрузчик на меню (счётчик новых), «Сводку» (плитка) и раздел
// /profi/admin/zayavki-par/ (список и срез). Только то, что лежит в `leads`:
// ни одной цифры сверх базы. Заявку пишет хук createLead; поля source, batch,
// venue/specialist размечены им же (и миграцией 1762600000 — старые).
// Персональные данные (имя, телефон) живут только в памяти страницы
// модератора: не в адресах, не в localStorage, не в консоли.
import { api, session } from './cabinet-api';

export type LeadStatus = 'new' | 'in-progress' | 'done' | 'spam';

/** статус → подпись и плашка (одно слово; цвет — смысл, cabinet-ui):
 *  новая — синий (ждёт нас, как «Проверить»), в работе — серый (ждём ответа пары),
 *  закрыта — зелёный (порядок), спам — красный (отбросили) */
export const LEAD_STATUS: Record<LeadStatus, { label: string; cls: string }> = {
  new: { label: 'Новая', cls: 'status--info' },
  'in-progress': { label: 'В работе', cls: '' },
  done: { label: 'Закрыта', cls: 'status--ok' },
  spam: { label: 'Спам', cls: 'status--bad' },
};

/** до какого потолка тянем заявки за раз: на пилоте их десятки, не тысячи */
const MAX_PAGES = 10;

let cache: { t: number; p: Promise<any[]> } | null = null;

/** все заявки пар, свежие сверху, с карточкой (expand); кэш 20 с — меню и раздел одним запросом */
export function loadLeads(force = false): Promise<any[]> {
  if (!session('moderator')) return Promise.resolve([]);
  if (!force && cache && Date.now() - cache.t < 20000) return cache.p;
  const p = (async () => {
    const out: any[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const res = await api('moderator', 'GET', `/api/collections/leads/records?perPage=500&page=${page}&sort=-created&expand=specialist,venue&filter=${encodeURIComponent('kind = "client"')}`);
      out.push(...res.items);
      if (page >= res.totalPages) break;
    }
    return out;
  })();
  cache = { t: Date.now(), p };
  p.catch(() => { cache = null; });
  return p;
}

export function dropLeadsCache() { cache = null; }

/** сколько отправок ждут нас (status = new). Считаем как строки списка: отправка
 *  из избранного трём карточкам — одна пара и одна строка, а не три */
export const newCount = (leads: any[]) => new Set(leads.filter((l) => (l.status || 'new') === 'new').map((l) => l.batch || l.id)).size;
/** отправок среди заявок (одна отправка из избранного = одна) */
export const sendCount = (leads: any[]) => new Set(leads.map((l) => l.batch || l.id)).size;

export const at = (d: string) => new Date(String(d).replace(' ', 'T')).getTime();

/** карточка заявки: имя, адрес визитки, категория (slug или 'venue') */
export function cardOf(l: any): { name: string; href: string; cat: string } {
  const sp = l.expand?.specialist;
  const ve = l.expand?.venue;
  const fromText = /^Карточка:\s*(.+)$/m.exec(String(l.message || ''))?.[1]?.trim() ?? '';
  let path = '';
  try { path = l.sourceUrl ? new URL(l.sourceUrl).pathname : ''; } catch {}
  const urlCat = /^\/moskva\/podryadchiki\/([a-z0-9-]+)\//.exec(path)?.[1] ?? (/^\/moskva\/ploshchadki\//.test(path) ? 'venue' : '');
  return {
    name: sp?.name || ve?.name || fromText || 'Карточка не указана',
    // ссылка — на наш сайт тем же путём (заявка могла прийти с превью или локального адреса)
    href: path || '',
    cat: sp ? sp.categorySlug : ve ? 'venue' : urlCat,
  };
}

/** текст пары без служебных строк, которые уже стоят в полях */
export function leadText(l: any): string {
  return String(l.message || '')
    .split('\n')
    .filter((s) => !/^(Карточка:|Из избранного, всем сразу|Дата свадьбы:)/.test(s.trim()))
    .join('\n')
    .trim();
}

/** одна отправка = одна строка: заявки «из избранного» с общим batch — вместе */
export interface LeadGroup { id: string; items: any[]; first: any; status: LeadStatus; fav: boolean }
export function groupLeads(leads: any[]): LeadGroup[] {
  const map = new Map<string, any[]>();
  for (const l of leads) {
    const key = l.batch ? `b:${l.batch}` : `l:${l.id}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(l);
  }
  return [...map.entries()].map(([id, items]) => {
    // статус группы — самый «ранний»: одна новая внутри — вся строка новая
    const order: LeadStatus[] = ['new', 'in-progress', 'done', 'spam'];
    const st = items.map((x) => (x.status || 'new') as LeadStatus).sort((a, b) => order.indexOf(a) - order.indexOf(b))[0];
    return { id, items, first: items[0], status: st, fav: items[0].source === 'favorites' };
  });
}
