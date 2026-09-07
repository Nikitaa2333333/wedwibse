// РУССКОЕ СКЛОНЕНИЕ ПРИ ЧИСЛЕ: «1 площадка / 2 площадки / 5 площадок».
// Формы всегда приходят тройкой [одна, две, пять] — в том же порядке,
// в каком их принимает шторка фильтров (проп `noun` у FilterSheet),
// откуда правило сюда и переехало: одинаковый код в двух местах —
// прямой способ их рассинхронить.

/** [одна, две, пять] — формы существительного при числе */
export type PluralForms = [one: string, few: string, many: string];

export function plural(n: number, forms: PluralForms): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return forms[0];
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return forms[1];
  return forms[2];
}

/** «12 ведущих» — число и подобранная к нему форма одной строкой */
export function withCount(n: number, forms: PluralForms): string {
  return `${n} ${plural(n, forms)}`;
}
