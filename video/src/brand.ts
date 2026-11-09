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

// Кабинет подрядчика — своя система (src/components/admin/base.css, скилл cabinet-ui):
// Inter, поле #eff2f7, белые плашки, цвет несёт смысл (--st-*).
export const CAB = {
  font: "'Inter', -apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
  bg: '#eff2f7',
  card: '#ffffff',
  text: '#1e242e',
  line: '#e6e9ef',
  ink: '#1d1d1f',
  placeholder: '#9aa1ad',
  okBg: '#e3f6e9',
  okStrong: '#17703a',
  okDot: '#22b04b',
  okText: '#1a8f43',
  infoBg: '#e8efff',
  infoStrong: '#1f4fa8',
  sheetRadius: 24,
  tileRadius: 28,
};

// Плавность — как --ease-out / --ease-inout сайта; linear не используем
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
export const EASE_INOUT = [0.65, 0, 0.35, 1] as const;
