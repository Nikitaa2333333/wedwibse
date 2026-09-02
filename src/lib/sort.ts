// Варианты сортировки каталога — один список для шторки на телефоне
// (FilterBar) и для группы «Сортировка» в левой колонке на ПК (FilterSheet).
// ЗАГЛУШКА: порядок и набор — до серверной выдачи.
export const SORTS = [
  { value: '', label: 'Популярные' },
  { value: 'price-asc', label: 'Сначала дешевле' },
  { value: 'price-desc', label: 'Сначала дороже' },
  { value: 'rating', label: 'Высокий рейтинг' },
] as const;
