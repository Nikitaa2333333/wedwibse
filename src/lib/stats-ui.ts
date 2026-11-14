// СТАТИСТИКА — общая отрисовка для кабинета подрядчика и админки (14.11.2026,
// docs/cabinet/STATS.md). Образец — мобильный Яндекс Директ (Евгений 09.11):
// строка = подпись, крупное число за период, справа график-заливка по дням.
// Ряд в графике один — легенды нет, его называет подпись строки. Касание или
// наведение на график показывает день и значение в той же строке.
// Данные — ответ /api/wed/my-stats или /api/wed/mod/stats (lib/stats.js).
// Пусто и ноль — разное: до первого дня счёта линия не рисуется, число — «нет данных».
import { esc } from './cabinet-api';

export interface CardSeries {
  id: string;
  kind: 'venue' | 'specialist';
  name: string;
  url: string;
  categorySlug: string;
  views: (number | null)[];
  visitors: (number | null)[];
  favs: (number | null)[];
  leads: number[];
  src: Record<string, number>;
}
export interface StatsData {
  days: string[];
  cards: CardSeries[];
  since: { views: string; favs: string };
}
export type Metric = 'views' | 'favs' | 'leads';

const NF = new Intl.NumberFormat('ru-RU');
const fmtDay = (d: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' }) =>
  new Date(`${d}T12:00:00`).toLocaleDateString('ru-RU', opts);

/** источники Метрики (ym:s:lastTrafficSource) — словами для подрядчика */
const SOURCE: Record<string, string> = {
  organic: 'Поиск Яндекса и Google',
  direct: 'Прямые заходы и закладки',
  internal: 'С нашего сайта',
  referral: 'Ссылки с других сайтов',
  social: 'Соцсети',
  messenger: 'Мессенджеры',
  ad: 'Реклама',
  email: 'Почта',
  recommend: 'Рекомендации',
};

/**
 * Сумма рядов нескольких карточек по дням. До дня, с которого идёт счёт
 * (since), — null (пусто); после — ноль там, где строки нет.
 */
export function sumSeries(data: StatsData, cards: CardSeries[], m: Metric): (number | null)[] {
  const from = m === 'views' ? data.since.views : m === 'favs' ? data.since.favs : '';
  return data.days.map((d, i) => {
    if (m !== 'leads' && (!from || d < from)) return null;
    return cards.reduce((s, c) => s + (c[m === 'views' ? 'views' : m][i] ?? 0), 0);
  });
}

export function visitorsTotal(data: StatsData, cards: CardSeries[]): number {
  return cards.reduce((s, c) => s + c.visitors.reduce<number>((a, v) => a + (v ?? 0), 0), 0);
}

export function sources(cards: CardSeries[]): [string, number][] {
  const acc: Record<string, number> = {};
  for (const c of cards) for (const [k, v] of Object.entries(c.src)) acc[k] = (acc[k] ?? 0) + v;
  return Object.entries(acc).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
}

/** график-заливка: 2px линия и мягкая заливка до нуля; пустые дни — разрыв */
function spark(values: (number | null)[]): string {
  const W = 120, H = 44, P = 3;
  const max = Math.max(1, ...values.map((v) => v ?? 0));
  const n = values.length;
  const x = (i: number) => (n === 1 ? W / 2 : (i / (n - 1)) * W);
  const y = (v: number) => H - P - (v / max) * (H - P * 2);
  const runs: [number, number][][] = [];
  let cur: [number, number][] = [];
  values.forEach((v, i) => {
    if (v == null) { if (cur.length) runs.push(cur); cur = []; return; }
    cur.push([x(i), y(v)]);
  });
  if (cur.length) runs.push(cur);
  const line = runs.map((r) => 'M' + r.map(([a, b]) => `${a.toFixed(1)} ${b.toFixed(1)}`).join('L')).join('');
  const area = runs.filter((r) => r.length > 1).map((r) => `M${r[0][0].toFixed(1)} ${H}L` + r.map(([a, b]) => `${a.toFixed(1)} ${b.toFixed(1)}`).join('L') + `L${r[r.length - 1][0].toFixed(1)} ${H}Z`).join('');
  return `<svg class="st-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><path class="st-spark__area" d="${area}"/><path class="st-spark__line" d="${line}" vector-effect="non-scaling-stroke"/><line class="st-spark__cursor" x1="0" x2="0" y1="0" y2="${H}" vector-effect="non-scaling-stroke" hidden/></svg>`;
}

const LABEL: Record<Metric, string> = { views: 'Переходы на карточку', favs: 'Добавили в избранное', leads: 'Заявки' };

/** одна строка «как в Директе»; values — по дням периода */
export function statRow(m: Metric, values: (number | null)[], data: StatsData, sub = ''): string {
  const known = values.some((v) => v != null);
  const total = values.reduce<number>((s, v) => s + (v ?? 0), 0);
  const from = m === 'views' ? data.since.views : m === 'favs' ? data.since.favs : '';
  // подстрока: посетители и, если счёт начался внутри периода, — с какого дня
  const note = !known ? (m === 'favs' ? 'Считаем с сегодняшнего дня' : 'Нет данных') : [sub, from && from > data.days[0] ? `считаем с ${fmtDay(from)}` : ''].filter(Boolean).join(', ').replace(/^./, (c) => c.toUpperCase());
  return `
    <div class="st-row" data-row data-values='${JSON.stringify(values)}' data-days='${JSON.stringify(data.days)}'>
      <div class="st-row__text">
        <span class="st-row__label">${LABEL[m]}</span>
        <span class="st-row__num" data-num>${known ? NF.format(total) : '—'}</span>
        <span class="st-row__sub" data-sub data-default="${esc(note)}">${esc(note)}</span>
      </div>
      ${known ? spark(values) : '<span class="st-spark st-spark--empty" aria-hidden="true"></span>'}
    </div>`;
}

/** «Откуда пришли»: столбики одним цветом, число и подпись прямо у столбика */
export function sourcesBlock(list: [string, number][]): string {
  if (!list.length) return '';
  const max = list[0][1];
  const total = list.reduce((s, [, v]) => s + v, 0);
  return `
    <section class="st-src">
      <h2 class="st-h">Откуда пришли</h2>
      <p class="st-src__lead">Заходы на сайт, которые начались с карточки</p>
      ${list.map(([k, v]) => `
        <div class="st-src__row">
          <span class="st-src__name">${esc(SOURCE[k] ?? 'Другое')}</span>
          <span class="st-src__val">${NF.format(v)} <span class="st-src__pct">${Math.round((v / total) * 100)}%</span></span>
          <span class="st-src__bar"><span style="width:${Math.max(4, (v / max) * 100)}%"></span></span>
        </div>`).join('')}
    </section>`;
}

/** касание и наведение на график: день и значение в подписи строки */
export function bindRows(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('[data-row]').forEach((row) => {
    const svg = row.querySelector<SVGSVGElement>('.st-spark');
    if (!svg || svg.classList.contains('st-spark--empty')) return;
    const values: (number | null)[] = JSON.parse(row.dataset.values!);
    const days: string[] = JSON.parse(row.dataset.days!);
    const sub = row.querySelector<HTMLElement>('[data-sub]')!;
    const cursor = svg.querySelector<SVGLineElement>('.st-spark__cursor')!;
    const show = (ev: PointerEvent) => {
      const r = svg.getBoundingClientRect();
      const i = Math.max(0, Math.min(days.length - 1, Math.round(((ev.clientX - r.left) / r.width) * (days.length - 1))));
      const v = values[i];
      sub.textContent = `${fmtDay(days[i])}: ${v == null ? 'нет данных' : NF.format(v)}`;
      const xx = (i / Math.max(1, days.length - 1)) * 120;
      cursor.setAttribute('x1', String(xx));
      cursor.setAttribute('x2', String(xx));
      cursor.hidden = false;
    };
    const hide = () => { sub.textContent = sub.dataset.default ?? ''; cursor.hidden = true; };
    svg.addEventListener('pointermove', show);
    svg.addEventListener('pointerdown', show);
    svg.addEventListener('pointerleave', hide);
  });
}

export function periodLabel(n: number) {
  return n === 7 ? 'за 7 дней' : n === 90 ? 'за 90 дней' : 'за 30 дней';
}
