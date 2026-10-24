// ЗАГЛУШКА для прототипа экрана модератора (CABINET.md §12, STAGE2.md
// «Экран модератора»). Здесь только ПРАВКИ уже опубликованных карточек;
// первая публикация новой карточки — это заявка партнёра (partner-demo.ts). «Было» — настоящие карточки сайта, «стало» — правка
// поверх них, как её пришлёт кабинет. Вживую правка — запись `revisions`
// (data = анкета целиком), флажки автопроверки ставит хук базы при отправке
// (`flags` — CABINET.md §12.6), браузеру не верим. Три полосы правок
// (§12.2) в интерфейс пока не выносим: ждут решения Евгения (STAGE2 §4, №4).
import type { StorySection } from './specialists';

/** На проверке — ждёт решения; проверено — решение принято (история). */
export type ModState = 'review' | 'approved' | 'returned';

/** Флажок автопроверки: какое правило сработало и где именно (§12.3). */
export interface ModFlag {
  rule: string;
  where: string;
  fragment?: string;
  /** кадр, на который сработало правило (чужое фото) */
  photo?: string;
}

/** Правка поверх карточки: только то, что подрядчик поменял. */
export interface DemoPatch {
  /** раздел текста по заголовку (title или lead, без них — '#номер') → новые абзацы */
  text?: Record<string, string[]>;
  /** новые разделы в конец */
  addSections?: StorySection[];
  priceFrom?: number;
  filters?: Record<string, string | string[]>;
  /** новые кадры в конец; если кадр уже есть в карточке, в «было» его нет */
  photosAdd?: string[];
  photosRemove?: string[];
  /** кадры, переставленные в начало (новая обложка) */
  photosToFront?: string[];
}

export interface DemoRevision {
  id: string;
  /** карточка на сайте (slug подрядчика) */
  slug: string;
  state: ModState;
  /** первая публикация: «было» пустое, карточка целиком */
  first?: boolean;
  submitted: string;
  /** сколько ждёт решения (срок ответа — 24 ч); у красных */
  waiting?: string;
  /** решение: когда и кто (у проверенных) */
  decided?: string;
  /** причина возврата словами модератора */
  reason?: string;
  flags: ModFlag[];
  patch: DemoPatch;
}

export const DEMO_REVISIONS: DemoRevision[] = [
  {
    id: 'suhorada-2',
    slug: 'suhorada',
    state: 'review',
    submitted: 'Сегодня, 12:04',
    waiting: '0 ч 10 мин',
    flags: [
      {
        rule: 'Похоже на контакт в тексте',
        where: 'Раздел «Эмоции в каждом снимке»',
        fragment: 'инста: suhorada.photo',
      },
      {
        rule: 'Кадр совпадает с кадром другого подрядчика',
        where: 'Даша Нирвани, фотограф — тот же снимок в её карточке',
        photo: '/specialists/fotografy/nirvani/gal/p05.webp',
      },
    ],
    patch: {
      text: {
        'Эмоции в каждом снимке': [
          'Для каждой пары я ищу свой подход и ловлю самые искренние эмоции — без натянутых улыбок и долгих постановок. Если понадобится, подскажу, как встать и куда смотреть, чтобы выглядеть в кадре естественно.',
          'Перед свадьбой встречаемся на кофе: обсуждаем план дня и места для прогулки. Примеры полных съёмок покажу при встрече — пишите, инста: suhorada.photo.',
        ],
        'Цены': [
          'Стоимость работы — от 10 000 ₽ за 1 час съёмки. При заказе 10 часов и более — большая фотокнига в подарок.',
        ],
      },
      priceFrom: 50000,
      filters: { priceHour: '10+', serviceType: ['full-day', 'partial', 'express', 'love-story'] },
      photosAdd: [
        '/specialists/fotografy/suhorada/gal/p41.webp',
        '/specialists/fotografy/suhorada/gal/p44.webp',
        '/specialists/fotografy/nirvani/gal/p05.webp',
      ],
      photosRemove: ['/specialists/fotografy/suhorada/gal/p03.webp'],
    },
  },
  {
    id: 'galkin-6',
    slug: 'galkin',
    state: 'approved',
    submitted: 'Сегодня, 11:20',
    decided: 'Одобрено сегодня в 11:25 · Никита',
    flags: [],
    patch: {
      text: {
        // раздел без своего заголовка — по номеру, как его видит хук
        '#3': [
          'Если вы хотите отлично проведённый праздник? И чтобы он запомнился всем не потому, что на нём были заезженные конкурсы из 90-х и 00-х? Тогда вы по адресу!',
          'Индивидуальный подход к абсолютно всем гостям от 5 до 95 лет!',
          'В сезоне 2027 у меня новая программа: интерактив без конкурсов, живой вокал и квиз о паре. Собираю её под ваших гостей — будут в восторге и взрослые, и молодёжь.',
        ],
      },
      photosAdd: [
        '/specialists/vedushchie/galkin/gal/p52.webp',
        '/specialists/vedushchie/galkin/gal/p53.webp',
        '/specialists/vedushchie/galkin/gal/p54.webp',
      ],
    },
  },
  {
    id: 'nirvani-9',
    slug: 'nirvani',
    state: 'returned',
    submitted: 'Сегодня, 10:05',
    decided: 'Вернули сегодня в 10:40 · Никита',
    reason: 'Задаток в тексте (15 000 ₽) не совпадает с прайсом — поправьте одно из двух.',
    flags: [],
    patch: {
      text: {
        'Бронирование': [
          'Чтобы зарезервировать тариф на съёмку, заключается договор и вносится задаток 15 000 ₽. Конечная стоимость зависит от даты и длительности съёмки.',
        ],
      },
      filters: { prepayment: '20-50' },
      photosToFront: [
        '/specialists/fotografy/nirvani/gal/p12.webp',
        '/specialists/fotografy/nirvani/gal/p07.webp',
      ],
    },
  },
];

/** Порядок: сначала на проверке, дольше ждущие выше (срок ответа 24 ч),
 *  потом проверенные. По нему же кнопка «Следующая». */
const minutes = (t?: string) => {
  const m = t?.match(/(\d+)\s*ч\s*(\d+)\s*мин/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
};
export const QUEUE: DemoRevision[] = [...DEMO_REVISIONS].sort(
  (a, b) => Number(a.state !== 'review') - Number(b.state !== 'review') || minutes(b.waiting) - minutes(a.waiting),
);

export const STATE: Record<ModState, { label: string; dot: string }> = {
  review: { label: 'На проверке', dot: 'info' },
  approved: { label: 'Одобрено', dot: 'ok' },
  returned: { label: 'Вернули', dot: 'bad' },
};
