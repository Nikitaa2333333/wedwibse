// Строки-определения .rows: две колонки — только когда все пары короткие.
// Длинное значение в узкой колонке рвётся по слову в строку и пары
// слипаются (заказчик, 08.10.2026). Порог — символы «метка + значение».
export const ROWS_PAIR_MAX = 30;

export function rowsClass(rows: { label: string; value: string }[] | undefined): string {
  const short = !!rows?.length && rows.every((r) => `${r.label} ${r.value}`.length <= ROWS_PAIR_MAX);
  return short ? 'rows rows--pairs' : 'rows';
}
