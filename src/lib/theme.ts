// ТЕМА САЙТА — светлая/тёмная, выбор человека, а не системная настройка.
//
// Тема живёт атрибутом data-theme на <html>: сама палитра — перекраска
// цветовых токенов в global.css, ни один компонент про тему не знает.
// Здесь только механика — прочитать выбор, применить, переключить.
//
// Выбор запоминается в localStorage и держится по всему сайту: переключил
// на главной — каталог и карточка площадки открываются уже в этой теме.
// Общесайтовой шапки у нас нет (SiteHeader выключен на дизайн-фазу), и
// сам тумблер стоит только в шапке главной — тем более он обязан помнить
// выбор, иначе с внутренней страницы тему было бы не вернуть.

export type Theme = 'light' | 'dark';

export const THEME_KEY = 'wed:theme';

/** Светлая — база проекта (кремовая бумага / тёплые чернила). Тёмная
 *  включается только руками, системную prefers-color-scheme намеренно
 *  не слушаем: это выбор оформления, а не режим чтения. */
export const DEFAULT_THEME: Theme = 'light';

/** Цвет адресной строки мобильного браузера — совпадает с --paper темы. */
const BAR_COLOR: Record<Theme, string> = {
  light: '#ffffff',
  dark: '#1c1815',
};

export function readTheme(): Theme {
  try {
    return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : DEFAULT_THEME;
  } catch {
    // приватный режим / выключенные куки — просто едем на светлой
    return DEFAULT_THEME;
  }
}

/** Применить тему к документу. Записью в localStorage не занимается:
 *  этим ведает toggleTheme, а стартовое применение ничего не сохраняет. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;

  // Светлая — это отсутствие атрибута, а не data-theme="light": палитра
  // светлой лежит в голом :root, и лишний атрибут только путал бы.
  if (theme === 'dark') root.dataset.theme = 'dark';
  else delete root.dataset.theme;

  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', BAR_COLOR[theme]);

  // Тумблеров на странице может быть несколько (шапка + будущие места) —
  // состояние держим на каждом. Это переключатель (role="switch"), поэтому
  // меняется только aria-checked: подпись у него постоянная, её же читает
  // и CSS реестра, двигая кружок по [aria-checked='true'].
  document.querySelectorAll<HTMLElement>('[data-theme-toggle]').forEach((btn) => {
    btn.setAttribute('aria-checked', String(theme === 'dark'));
  });
}

/** Переключить и запомнить. Возвращает тему, которая встала. */
export function toggleTheme(): Theme {
  const next: Theme = readTheme() === 'dark' ? 'light' : 'dark';

  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    // не сохранилось — тема всё равно применится на этой странице
  }

  applyTheme(next);
  return next;
}
