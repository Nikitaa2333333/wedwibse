// Бренд WED Secrets для ролика — значения из src/styles/global.css сайта.
// Меняется на сайте — меняем здесь (одна палитра на проект).
export const BRAND = {
  // бумага и чернила (основная тема сайта)
  paper: '#ffffff',
  ink: '#1a1613',
  // кремовая тема карточек (theme-cream)
  cream: '#f6efe5',
  chocolate: '#45322a',
  // тёмная тема
  darkPaper: '#1c1815',
  darkInk: '#f0ebe3',
  // акцент — точечно (состояние, отметка), не заливкой кадра
  accent: '#e8592a',
  // Onest — набор и служебное; Cormorant — крупные заголовки и фразы
  sans: "'Onest', system-ui, sans-serif",
  serif: "'Cormorant', Georgia, serif",
};

// Плавность — как --ease-out / --ease-inout сайта; linear не используем
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
export const EASE_INOUT = [0.65, 0, 0.35, 1] as const;
