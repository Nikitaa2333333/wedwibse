// Счётчики у пунктов фильтра («Лофт 4», «до 80 гостей 6») — считаются на
// сборке из тех же данных, что уходят в data-filters карточек. Число — сколько
// карточек попадёт в выдачу, если включить только этот пункт.
// ЗАГЛУШКА: с бэкендом счётчики придут готовыми (facet counts), сама
// разметка чипа не изменится.
import type { FilterGroup } from '../data/specialists';

export type CardFilters = Record<string, string | string[]>;
export type FilterCounts = Record<string, Record<string, number>>;

export function countOptions(groups: FilterGroup[], cards: CardFilters[]): FilterCounts {
  const counts: FilterCounts = {};
  for (const group of groups) {
    const byValue: Record<string, number> = {};
    for (const opt of group.options) {
      byValue[opt.value] = cards.filter((card) => {
        const v = card[group.key];
        return Array.isArray(v) ? v.includes(opt.value) : v === opt.value;
      }).length;
    }
    counts[group.key] = byValue;
  }
  return counts;
}
