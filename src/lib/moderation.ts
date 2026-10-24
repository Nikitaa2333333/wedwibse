// Разбор правки для экрана модератора (CABINET.md §12.5): из карточки
// («было») и правки («стало») — разделы текста сравнением по словам,
// изменившиеся фильтры «было → стало», фото группами и сводка одной строкой
// (та же, что уйдёт уведомлением в Telegram). Вживую «было» — опубликованная
// карточка, «стало» — `revisions.data`; логика та же, меняется источник.
import {
  findSpecialist,
  FILTERS_BY_CATEGORY,
  specialistRole,
  specialistUrl,
  type Specialist,
  type StorySection,
} from '../data/specialists';
import type { DemoRevision } from '../data/moderation-demo';
import { changedShare, wordDiff, type DiffPart } from './word-diff';

export interface SectionDiff {
  name: string;
  state: 'changed' | 'added' | 'removed';
  /** абзацы раздела; неизменённые экран сворачивает (как GitHub) */
  paras: { parts: DiffPart[]; changed: boolean }[];
}

/** Разбор по словам → абзацы: части режутся по пустой строке. */
function toParas(parts: DiffPart[]): SectionDiff['paras'] {
  const paras: SectionDiff['paras'] = [{ parts: [], changed: false }];
  for (const p of parts) {
    p.text.split(/(\n\n)/).forEach((chunk) => {
      if (chunk === '\n\n') {
        // разрыв абзаца внутри удалённого/добавленного куска — тоже правка
        if (p.kind !== 'same') paras[paras.length - 1].changed = true;
        paras.push({ parts: [], changed: false });
        return;
      }
      if (!chunk) return;
      const cur = paras[paras.length - 1];
      cur.parts.push({ kind: p.kind, text: chunk });
      if (p.kind !== 'same') cur.changed = true;
    });
  }
  return paras.filter((x) => x.parts.length);
}

export interface FilterRow {
  label: string;
  before: string;
  after: string;
}

export interface Review {
  rev: DemoRevision;
  card: Specialist;
  role: string;
  url: string;
  sections: SectionDiff[];
  /** разделов без изменений */
  same: number;
  share: { changed: number; total: number };
  price?: { before?: number; after?: number };
  filters: FilterRow[];
  photos: { added: string[]; removed: string[]; moved: string[]; after: string[] };
  summary: string;
}

// Тексты карточек прошли типограф: между словами неразрывные пробелы.
// Заголовок раздела сравниваем с приведёнными пробелами.
const norm = (s: string) => s.replace(/[\s  ]+/g, ' ').trim();
const sectionKey = (s: StorySection, i: number) => norm(s.title ?? s.lead ?? `#${i}`);
const sectionName = (s: StorySection, i: number) => s.title ?? s.lead ?? `Раздел ${i + 1}, без заголовка`;

/** Раздел одной строкой для сравнения: абзацы через пустую строку, пункты с «—». */
function sectionText(s: StorySection): string {
  const out: string[] = [];
  if (s.lead && s.title) out.push(s.lead);
  out.push(...(s.text ?? []));
  out.push(...(s.list ?? []).map((x) => `— ${x}`));
  out.push(...(s.tiles ?? []).map((x) => `— ${x}`));
  for (const it of s.items ?? []) out.push([it.title, it.text, ...(it.list ?? []).map((x) => `— ${x}`)].filter(Boolean).join('\n'));
  for (const t of s.tariffs ?? [])
    out.push([`${t.name} — ${t.price}${t.unit ? ` ${t.unit}` : ''}`, ...(t.includes ?? []).map((x) => `— ${x}`), t.note].filter(Boolean).join('\n'));
  out.push(...(s.stats ?? []).map((x) => `${x.value} ${x.label}`));
  out.push(...(s.after ?? []));
  return out.join('\n\n');
}

const rub = (n: number) => `${n.toLocaleString('ru-RU')} ₽`;

export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

export function buildReview(rev: DemoRevision): Review {
  const card = findSpecialist(rev.slug);
  if (!card) throw new Error(`moderation-demo: нет карточки ${rev.slug}`);
  const p = rev.patch;
  const story = card.story ?? [];
  const textPatch = Object.fromEntries(Object.entries(p.text ?? {}).map(([k, v]) => [norm(k), v]));

  // «было»: у первой публикации пусто; добавленные кадры, которые уже лежат
  // в карточке (демо берёт их из её же галереи), из «было» убираем
  const added = p.photosAdd ?? [];
  const beforePhotos = rev.first ? [] : card.photos.filter((x) => !added.includes(x));
  const front = p.photosToFront ?? [];
  const kept = beforePhotos.filter((x) => !(p.photosRemove ?? []).includes(x));
  const afterPhotos = rev.first ? card.photos : [...front, ...kept.filter((x) => !front.includes(x)), ...added];

  // текст по разделам
  const sections: SectionDiff[] = [];
  let same = 0;
  const all: DiffPart[] = [];
  story.forEach((s, i) => {
    const next = textPatch[sectionKey(s, i)];
    const before = rev.first ? '' : sectionText(s);
    const after = next ? sectionText({ ...s, text: next }) : sectionText(s);
    if (before === after) { same++; return; }
    const parts = wordDiff(before, after);
    all.push(...parts);
    sections.push({ name: sectionName(s, i), state: rev.first ? 'added' : 'changed', paras: toParas(parts) });
  });
  for (const s of p.addSections ?? []) {
    const parts = wordDiff('', sectionText(s));
    all.push(...parts);
    sections.push({ name: sectionName(s, story.length), state: 'added', paras: toParas(parts) });
  }

  // фильтры: только изменившиеся строки, значения — подписями из набора категории
  const groups = FILTERS_BY_CATEGORY[card.categorySlug] ?? [];
  const beforeF: Record<string, unknown> = rev.first ? {} : { ...(card.filters ?? {}) };
  const afterF: Record<string, unknown> = { ...(card.filters ?? {}), ...(p.filters ?? {}) };
  const show = (key: string, v: unknown) => {
    if (v == null || (Array.isArray(v) && !v.length)) return 'пусто';
    const opts = groups.find((g) => g.key === key)?.options ?? [];
    return (Array.isArray(v) ? v : [v]).map((x) => opts.find((o) => o.value === x)?.label ?? String(x)).join(', ');
  };
  const filters: FilterRow[] = [];
  for (const g of groups) {
    const b = beforeF[g.key];
    const a = afterF[g.key];
    if (JSON.stringify(b) === JSON.stringify(a)) continue;
    filters.push({ label: g.label, before: show(g.key, b), after: show(g.key, a) });
  }

  const priceBefore = rev.first ? undefined : card.priceFrom;
  const priceAfter = p.priceFrom ?? card.priceFrom;
  const price = priceBefore !== priceAfter ? { before: priceBefore, after: priceAfter } : undefined;

  const photos = {
    added: rev.first ? card.photos : added,
    removed: p.photosRemove ?? [],
    moved: front,
    after: afterPhotos,
  };

  // сводка — как в уведомлении модератору (§12.5)
  const bits: string[] = [];
  if (rev.first) {
    bits.push('новая карточка', `${card.photos.length} фото`, `${sections.length} ${plural(sections.length, 'раздел', 'раздела', 'разделов')} текста`);
  } else {
    if (price?.before && price.after) bits.push(`цена от ${rub(price.before)} → ${rub(price.after)}`);
    if (photos.added.length) bits.push(`+${photos.added.length} фото`);
    if (photos.removed.length) bits.push(`−${photos.removed.length} фото`);
    if (photos.moved.length) bits.push('новая обложка');
    if (sections.length) bits.push(`текст: ${sections.length} ${plural(sections.length, 'раздел', 'раздела', 'разделов')}`);
    if (filters.length) bits.push(`${filters.length} ${plural(filters.length, 'фильтр', 'фильтра', 'фильтров')}`);
  }

  return {
    rev,
    card,
    role: specialistRole(card),
    url: specialistUrl(card),
    sections,
    same,
    share: changedShare(all),
    price,
    filters,
    photos,
    summary: bits.join(' · '),
  };
}
