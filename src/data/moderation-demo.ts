// ЗАГЛУШКА для прототипа экрана модератора (CABINET.md §12, STAGE2.md
// «Экран модератора»). «Было» — настоящие карточки сайта, «стало» — правка
// поверх них, как её пришлёт кабинет. Вживую правка — запись `revisions`
// (data = анкета целиком), полосу и флажки ставит хук базы при отправке
// (`lane`, `flags` — CABINET.md §12.6), браузеру не верим.
import type { StorySection } from './specialists';

export type Lane = 'red' | 'yellow' | 'green';

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
  lane: Lane;
  /** первая публикация: «было» пустое, карточка целиком */
  first?: boolean;
  submitted: string;
  /** сколько ждёт решения (срок ответа — 24 ч); у красных */
  waiting?: string;
  /** у жёлтой и зелёной — уже на сайте */
  published?: string;
  /** доверие (§12.4) */
  trust: string;
  /** почему эта полоса — словами хука */
  why: string[];
  flags: ModFlag[];
  patch: DemoPatch;
}

export const DEMO_REVISIONS: DemoRevision[] = [
  {
    id: 'suhorada-2',
    slug: 'suhorada',
    lane: 'red',
    submitted: 'Сегодня, 12:04',
    waiting: '0 ч 10 мин',
    trust: 'Новый в кабинете · одобренных правок нет',
    why: [
      'Новые фото у нового подрядчика',
      'Сработала автопроверка: ник в тексте и чужое фото',
      'Переписана половина раздела «Эмоции в каждом снимке»',
    ],
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
    id: 'go-show-1',
    slug: 'go-show',
    lane: 'red',
    first: true,
    submitted: 'Сегодня, 09:38',
    waiting: '2 ч 36 мин',
    trust: 'Новая карточка',
    why: ['Первая публикация — всегда через проверку'],
    flags: [],
    patch: {},
  },
  {
    id: 'galkin-6',
    slug: 'galkin',
    lane: 'yellow',
    submitted: 'Сегодня, 11:20',
    published: 'На сайте с 11:20',
    trust: 'Проверенный · 5 правок одобрено без возвратов',
    why: ['Заметная правка текста у проверенного подрядчика', 'Новые фото — проверенным можно сразу'],
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
    lane: 'green',
    submitted: 'Сегодня, 10:05',
    published: 'На сайте с 10:05',
    trust: 'Проверенный · 8 правок одобрено без возвратов',
    why: ['Мелкая правка: фильтр, одно число в тексте, порядок фото'],
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

/** Порядок очереди: сначала ждущие решения, дольше ждущие — выше (срок 24 ч),
 *  потом «проверить после», потом «прошли сами». По нему же «Следующая». */
const LANE_RANK: Record<Lane, number> = { red: 0, yellow: 1, green: 2 };
const minutes = (s?: string) => {
  const m = s?.match(/(\d+)\s*ч\s*(\d+)\s*мин/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
};
export const QUEUE: DemoRevision[] = [...DEMO_REVISIONS].sort(
  (a, b) => LANE_RANK[a.lane] - LANE_RANK[b.lane] || minutes(b.waiting) - minutes(a.waiting),
);

export const LANE: Record<Lane, { label: string; status: string; queue: string; note: string }> = {
  red: {
    label: 'Ждёт проверки',
    status: 'status--info',
    queue: 'Ждут решения',
    note: 'На сайте прежняя версия, пока не одобрите',
  },
  yellow: {
    label: 'На сайте · проверить после',
    status: 'status--warn',
    queue: 'Проверить после',
    note: 'Уже на сайте. Если что-то не так — откатите одной кнопкой',
  },
  green: {
    label: 'Прошло само',
    status: 'status--ok',
    queue: 'Прошли сами',
    note: 'Мелкие правки — на сайте сразу, здесь для сведения',
  },
};
