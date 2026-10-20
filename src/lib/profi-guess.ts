// Угадываем ответ на вопрос «Кто снимает» по имени карточки, чтобы человеку
// не отвечать на очевидное (Никита, 20.10.2026): «Алексей» — мужчина,
// «Анна» — женщина, «Иван и Мария» или «студия» — пара/команда.
// Это подсказка: ответ ставится сам, человек может поменять.
const MALE_ENDING_A = new Set(['никита', 'илья', 'данила', 'савва', 'лёва', 'гоша', 'миша', 'саша', 'женя', 'валя']);

export function guessGender(name: string): 'м' | 'ж' | 'pair' | null {
  const n = name.trim().toLowerCase();
  if (!n) return null;
  if (/( и | & |\+|студия|команда|studio|team)/.test(n)) return 'pair';
  const first = n.split(/\s+/)[0];
  if (MALE_ENDING_A.has(first)) return 'м';
  if (/[ая]$/.test(first)) return 'ж';
  return 'м';
}
