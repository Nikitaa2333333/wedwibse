// ПРОМО ДЛЯ ПОДРЯДЧИКОВ И ПЛОЩАДОК (сценарий Никиты 09.11.2026), ~88 с.
// Часть 1 — глазами пары: каталог, сохраняют понравившиеся (иконки специалистов), заявка.
// Часть 2 — кабинет: заявка пришла, видна вся статистика.
// Часть 3 — «добавьте вашу карточку»: описание свободным текстом, фото ссылкой на Яндекс Диск
// → ваша страница — ваша презентация → её найдут в Яндексе и Google → мы её продвигаем.
// Телефон — настоящая 3D-модель (model.tsx) под живым экраном, грань не показываем.
// Пушей нет — всё через сайт. Логотип с главной — в начале и в конце. Звук — public/sfx (sfx.py).
import React from 'react';
import { AbsoluteFill, Audio, Img, Sequence, interpolate, staticFile, useVideoConfig } from 'remotion';
import R from '../public/ui/rects.json';
import { BRAND, CAB } from './brand';
import {
  ADD_RECT, AddDisk, Btn, CabScreen, Chip, EditorHead, FieldCard, INTEREST_RECT, InterestSheet, LEAD_RECT, LeadCard, LeadsScreen,
  MyCardsScreen, PILL_RECT, PhotoGrid, ProgressPill, SUBMIT_RECT, Tile, TileState, YdDialog, tileRect,
} from './promo/cabinet';
import { Tempo, easeInOut, kf, press, prog, typed, useT } from './promo/motion';
import { IslandPill, Lift, Phone3D, Pose } from './promo/phone3d';
import { Logo, SCREEN_H, SCREEN_W, Tap, Words, useLayout, useTheme } from './promo/stage';

// Темп: ключи сцены — в «своих» кадрах, Tempo растягивает их в 1,6 раза (Никита: «не успеваю прочитать»)
const RATE = 0.625;
const SCENE_END = 1660;
export const DEMO_DURATION = Math.ceil(SCENE_END / RATE);

const S = (p: string) => staticFile(p);
const HEART = 'M2 9.1371C2 14 6.01943 16.5914 8.96173 18.9109C10 19.7294 11 20.5 12 20.5C13 20.5 14 19.7294 15.0383 18.9109C17.9806 16.5914 22 14 22 9.1371C22 4.27416 16.4998 0.825464 12 5.50063C7.50016 0.825464 2 4.27416 2 9.1371Z';
const LED = ['g15', 'g16', 'g18', 'g14', 'g2', 'g9', 'g7', 'g8', 'g10'].map((g) => `venues/led/gal/${g}.webp`);
const LED_TEXT = 'Стеклянная оранжерея в сосновом лесу на Новой Риге: зал на 60 гостей, отдельная веранда и своя территория в тридцати минутах от центра Москвы.';

const tileCY = R.feedTile.y + R.feedTile.h / 2;
const FEED_END = tileCY - SCREEN_H / 2;
const tile = { x: R.feedTile.x, y: R.feedTile.y - FEED_END, w: R.feedTile.w, h: R.feedTile.h };
type Rc = { x: number; y: number; w: number; h: number };
const c = (r: Rc) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const pad = (r: Rc, p = 0) => ({ x: r.x - p, y: r.y - p, w: r.w + 2 * p, h: r.h + 2 * p });

/** кусок снимка экрана — для элемента, вынутого над стеклом */
const Crop: React.FC<{ src: string; r: Rc }> = ({ src, r }) => (
  <div style={{ position: 'relative', width: r.w, height: r.h, overflow: 'hidden' }}>
    <Img src={S(src)} style={{ position: 'absolute', left: -r.x, top: -r.y, width: SCREEN_W, height: SCREEN_H }} />
  </div>
);

/** экран, въезжающий сбоку */
const Slide: React.FC<{ f: number; at: number; from?: 1 | -1; children: React.ReactNode }> = ({ f, at, from = 1, children }) => {
  const t = prog(f, at, at + 14, easeInOut);
  return <div style={{ position: 'absolute', inset: 0, transform: `translateX(${(1 - t) * 100 * from}%)`, boxShadow: t < 1 ? '-20px 0 40px rgba(0,0,0,0.12)' : 'none' }}>{children}</div>;
};

// ——— иконки специалистов (свои, линией, как Glyph) ———
const ICONS = [
  'M4 21V10l8-6 8 6v11M9 21v-6a3 3 0 0 1 6 0v6M3 21h18', // площадка
  'M4 8h3l2-2h6l2 2h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z', // фотограф
  'M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM6 11a6 6 0 0 0 12 0M12 17v4M9 21h6', // ведущий
  'M4 21h16M5 21v-7h14v7M5 17c2 1.5 4.5 1.5 7 0s5-1.5 7 0M8 14v-3h8v3M12 11V8M12 6.5c.8 0 1.3-.7 1.3-1.4S12 3 12 3s-1.3 1.4-1.3 2.1.5 1.4 1.3 1.4z', // торт
  'M12 13l-3 8h6l-3-8zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM7 10a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM17 10a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z', // флорист
  'M9 20a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM15 20a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM10 6l2-3 2 3', // кольца
  'M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z', // музыканты
];
const IconRow: React.FC<{ f: number; from: number; to: number; ink: string; top: number; left: number; size: number }> = ({ f, from, to, ink, top, left, size }) => {
  if (f < from || f > to) return null;
  const out = prog(f, to - 14, to, easeInOut);
  return (
    <div style={{ position: 'absolute', left, top, display: 'flex', gap: size * 0.22, opacity: 1 - out, zIndex: 30 }}>
      {ICONS.map((d, i) => {
        const t0 = prog(f, from + i * 4, from + i * 4 + 24);
        return (
          <div key={i} style={{ width: size, height: size, borderRadius: '50%', border: `2px solid ${ink}`, display: 'grid', placeItems: 'center', opacity: t0,
            transform: `translateY(${(1 - t0) * 24}px) scale(${0.8 + 0.2 * t0})`, filter: t0 < 1 ? `blur(${(1 - t0) * 8}px)` : 'none' }}>
            <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
          </div>
        );
      })}
    </div>
  );
};

// ——— выдача поиска (иллюстрация, без чужих марок) ———
const SEARCH_RECT = { x: 14, y: 300, w: 362, h: 168 };
const SearchCard: React.FC = () => (
  <div style={{ width: SEARCH_RECT.w, height: SEARCH_RECT.h, boxSizing: 'border-box', background: '#fff', borderRadius: 22, padding: '18px 20px', fontFamily: CAB.font, color: CAB.text, display: 'grid', gap: 8, alignContent: 'start' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
      <span style={{ width: 26, height: 26, borderRadius: 13, background: BRAND.cream, display: 'grid', placeItems: 'center' }}>
        <span style={{ width: 16, height: 6, background: BRAND.chocolate, WebkitMaskImage: `url(${S('logo-unicase.svg')})`, WebkitMaskSize: 'contain', WebkitMaskRepeat: 'no-repeat' }} />
      </span>
      <span>wed-secrets.ru › moskva › ploshchadki › led</span>
    </div>
    <div style={{ fontSize: 19, lineHeight: '24px', fontWeight: 600 }}>LЁD — стеклянная оранжерея для свадьбы в сосновом лесу</div>
    <div style={{ fontSize: 14, lineHeight: '19px' }}>Зал на 60 гостей, веранда и своя территория в тридцати минутах от центра Москвы.</div>
  </div>
);

export const Demo: React.FC = () => (
  <>
    <Tempo rate={RATE}><DemoScene /></Tempo>
    <Sound />
  </>
);

// ——— звук: события в кадрах сцены → кадры ролика ———
const at = (sf: number) => Math.round(sf / RATE);
const typingTicks = (a: number, b: number, step = 3) => Array.from({ length: Math.floor((b - a) / step) }, (_, i) => a + i * step);
const SFX: [string, number, number][] = [
  ['whoosh', 58, 0.5], ['whoosh', 484, 0.45], ['whoosh', 792, 0.45], ['whoosh', 1264, 0.5], ['whoosh', 1538, 0.45],
  ['tap', 215, 0.7], ['tap', 285, 0.7], ['tap', 388, 0.7], ['tap', 456, 0.7], ['tap', 580, 0.7], ['tap', 846, 0.7], ['tap', 984, 0.7], ['tap', 1070, 0.7], ['tap', 1228, 0.7],
  ['pop', 292, 0.6], ['pop', 372, 0.45], ['pop', 438, 0.45], ['pop', 534, 0.45], ['pop', 672, 0.45], ['pop', 964, 0.45], ['pop', 1074, 0.45], ['pop', 1214, 0.45], ['pop', 1376, 0.5],
  ['chime', 506, 0.5], ['chime', 1248, 0.4],
  ...typingTicks(870, 935).map((s) => ['tick', s, 0.35] as [string, number, number]),
  ...typingTicks(1008, 1026).map((s) => ['tick', s, 0.35] as [string, number, number]),
  ...Array.from({ length: 9 }, (_, i) => ['tick', 1043 + i * 3, 0.5] as [string, number, number]),
];
const Sound: React.FC = () => {
  const { durationInFrames } = useVideoConfig();
  return (
    <>
      <Audio src={S('sfx/pad.wav')} volume={(fr) => 0.55 * interpolate(fr, [0, 45, durationInFrames - 75, durationInFrames - 1], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} />
      {SFX.map(([n, sf, v], i) => (
        <Sequence key={i} from={at(sf)} durationInFrames={90} layout="none"><Audio src={S(`sfx/${n}.wav`)} volume={v} /></Sequence>
      ))}
    </>
  );
};

const DemoScene: React.FC = () => {
  const f = useT();
  const L = useLayout();
  const th = useTheme([[478, 0], [498, 1], [1262, 1], [1286, 0]]);
  const ink = th.ink;
  const b = L.phone.screenW / SCREEN_W;

  // ——— поза телефона ———
  const pose: Pose = {
    x: L.phone.cx,
    // телефон въезжает из-за нижнего края в пустой кадр — не проявляется на месте (Никита 09.11)
    y: L.phone.cy + kf(f, [[60, 1900], [122, 0], [146, 150], [188, 150], [206, 0], [366, 0], [380, L.wide ? 0 : -110], [470, L.wide ? 0 : -110], [490, 0], [1540, 0], [1580, 1900]]),
    s: kf(f, [[122, b], [146, b * 1.9], [188, b * 1.9], [206, b * 1.02], [262, b * 1.02], [278, b * 1.5], [350, b * 1.5], [366, b * 1.1], [476, b * 1.1], [490, b * 1.02], [506, b * 1.1], [850, b * 1.1], [866, b * 1.3], [938, b * 1.3], [954, b * 1.1], [1266, b * 1.1], [1290, b * 1.02], [1540, b * 1.02]]),
    rx: kf(f, [[60, 14], [122, 6], [146, 16], [188, 18], [206, 4], [262, 4], [278, 8], [350, 8], [366, 6], [1540, 6], [1580, 12]]),
    ry: kf(f, [[60, -14], [122, -9], [146, 7], [188, 10], [206, -4], [262, -4], [278, 9], [350, 9], [366, -9], [468, -9], [502, 9], [638, 9], [662, -9], [790, -9], [820, 8], [945, 8], [975, -8], [1130, -8], [1160, 8], [1266, 8], [1300, -6], [1370, -6], [1400, 7], [1460, 7], [1500, -6], [1580, 4]]),
    rz: kf(f, [[60, -8], [122, -3], [146, -12], [188, -9], [206, 0], [262, 0], [278, -3], [350, -3], [366, 2], [638, 2], [662, -3], [820, 2], [975, -2], [1160, 2], [1300, -2], [1400, 2], [1500, -2], [1580, -6]]),
    fx: kf(f, [[262, 195], [278, 240], [350, 240], [366, 195]]),
    fy: kf(f, [[122, 422], [146, 470], [188, 470], [206, 422], [262, 422], [278, 150], [350, 150], [366, 422], [850, 422], [866, 300], [938, 300], [954, 422]]),
  };

  // ——— часть 1: сайт ———
  const scroll = kf(f, [[64, 0], [120, FEED_END * 0.3], [190, FEED_END * 0.94], [212, FEED_END]]);
  const sheet = prog(f, 398, 420, easeInOut);
  const saved = prog(f, 285, 292);
  const siteLayer = (
    <>
      {f < 218 && (
        <div style={{ position: 'absolute', inset: 0, background: BRAND.cream }}>
          <Img src={S('ui/feed.jpg')} style={{ position: 'absolute', left: 0, top: -scroll, width: SCREEN_W }} />
          <Tap x={c(tile).x} y={c(tile).y} at={215} />
        </div>
      )}
      {/* тап — и сразу полная страница, без «слайд-шоу» (Никита 08.11) */}
      {f >= 218 && (
        <div style={{ position: 'absolute', inset: 0 }}>
          <Img src={S('ui/venue-villa-barvikha.png')} style={{ position: 'absolute', inset: 0, width: SCREEN_W, height: SCREEN_H }} />
          <svg width={26} height={26} viewBox="0 0 24 24" style={{ position: 'absolute', left: c(R.heart).x - 13, top: c(R.heart).y - 13, opacity: saved, transform: `scale(${1 + 0.6 * kf(f, [[285, 0], [290, 1], [298, 0]])})` }}>
            <path d={HEART} fill="#fff" stroke="#fff" strokeWidth={1.5} strokeLinejoin="round" />
          </svg>
          <Tap x={c(R.heart).x} y={c(R.heart).y} at={285} />
          {sheet > 0 && <Img src={S('ui/booking.png')} style={{ position: 'absolute', inset: 0, width: SCREEN_W, height: SCREEN_H, clipPath: 'inset(64px 0 0 0)', transform: `translateY(${(1 - sheet) * 790}px)` }} />}
        </div>
      )}
    </>
  );

  // ——— часть 2–3: кабинет ———
  const toCards = prog(f, 640, 660, easeInOut);
  const plus = prog(f, 700, 712);
  const tilesIn = (i: number) => prog(f, 806 + i * 3, 820 + i * 3);
  const allDone = f >= 1196;
  const tiles: TileState[] = [
    { key: 'main', title: 'Основное', ic: 'user', sub: 'LЁD, Новая Рига', done: true },
    { key: 'photo', title: 'Фото', ic: 'photo', sub: f >= 1124 ? '9 фото' : 'пусто', done: f >= 1124 },
    { key: 'video', title: 'Видео', ic: 'video', sub: 'по желанию', optional: true },
    { key: 'halls', title: 'Залы', ic: 'halls', sub: '1 зал, до 60 гостей', done: true },
    { key: 'terms', title: 'Условия', ic: 'chat', sub: 'Кухня, алкоголь', done: true },
    { key: 'desc', title: 'Описание', ic: 'doc', sub: f >= 940 ? 'заполнено' : 'пусто', done: f >= 940 },
    { key: 'ask', title: 'Вопросы', ic: 'ask', sub: '4 ответа', done: true },
    { key: 'cont', title: 'Контакты', ic: 'phone', sub: 'телефон', done: true },
  ];
  const submit = (
    <div style={{ width: SUBMIT_RECT.w, height: SUBMIT_RECT.h, display: 'grid', placeItems: 'center' }}>
      {f < 1232 ? <Btn dark h={SUBMIT_RECT.h} style={{ width: '100%', transform: `scale(${press(f, 1228)})`, fontFamily: CAB.font }}>Отправить на проверку</Btn>
        // кнопка сворачивается в одну плашку статуса (Никита 08.11)
        : f < 1246 ? <Chip kind="info" style={{ fontFamily: CAB.font, transform: `scale(${1.6 * (0.8 + 0.2 * prog(f, 1232, 1240))})` }}>На проверке</Chip>
          : <Chip kind="ok" style={{ fontFamily: CAB.font, transform: `scale(${1.6 * (0.8 + 0.2 * prog(f, 1246, 1254))})` }}>На сайте</Chip>}
    </div>
  );
  const editor = (
    <CabScreen>
      <EditorHead title="LЁD" />
      {tiles.map((t, i) => {
        const r = tileRect(i);
        const a = allDone ? 1 : tilesIn(i);
        return <div key={t.key} style={{ position: 'absolute', left: r.x, top: r.y, opacity: a, transform: `translateY(${(1 - a) * 24}px) scale(${i === 5 ? press(f, 846) : 1})` }}><Tile t={t} /></div>;
      })}
      <div style={{ position: 'absolute', left: SUBMIT_RECT.x, top: SUBMIT_RECT.y, opacity: allDone ? 1 : 0.4 }}>{f < 1232 ? submit : <Btn dark h={SUBMIT_RECT.h} style={{ width: SUBMIT_RECT.w, opacity: 0 }}> </Btn>}</div>
      {!allDone && <Tap {...c(tileRect(5))} at={846} />}
    </CabScreen>
  );
  const ydUp = prog(f, 990, 1004, easeInOut) - prog(f, 1116, 1128, easeInOut);
  const picks = Math.max(0, Math.min(9, Math.floor((f - 1040) / 3)));
  const pct = kf(f, [[1076, 0], [1110, 100]]);
  const photos = (
    <CabScreen>
      <EditorHead title="Фото" back="LЁD" />
      <div style={{ position: 'absolute', left: ADD_RECT.x, top: ADD_RECT.y }}><AddDisk /></div>
      <div style={{ position: 'absolute', left: 20, top: 216, width: 340, fontSize: 14, lineHeight: '19px' }}>Много фото — удобнее ссылкой на папку: выберите кадры, мы заберём оригиналы</div>
      <PhotoGrid photos={LED} top={276} visible={Math.max(0, Math.floor((f - 1122) / 1.5))} />
      {ydUp > 0 && (
        <div style={{ position: 'absolute', inset: 0, transform: `translateY(${(1 - ydUp) * 800}px)` }}>
          <YdDialog url={typed('disk.yandex.ru/d/led-svadby', f, 1008, 1026)}
            bar={f >= 1043 && (
              <div style={{ position: 'absolute', left: 4, right: 4, top: PILL_RECT.y - 70 }}>
                {f < 1072 ? <Btn dark h={52} style={{ transform: `scale(${press(f, 1070)})` }}>Добавить {picks} фото</Btn> : <div style={{ marginLeft: 12 }}><ProgressPill pct={pct} /></div>}
                <Tap x={191} y={26} at={1070} />
              </div>
            )}>
            <PhotoGrid photos={LED} top={206} cell={120} visible={Math.max(0, Math.floor((f - 1030) / 1.2))} pickedAt={(i) => (i < picks ? i + 1 : null)} />
          </YdDialog>
        </div>
      )}
    </CabScreen>
  );
  const desc = (
    <CabScreen>
      <EditorHead title="Описание" back="LЁD" />
      <FieldCard label="О площадке" h={300} style={{ position: 'absolute', left: 4, top: 104, width: 382 }}>
        <div style={{ fontSize: 17, lineHeight: '25px', color: f < 870 ? CAB.placeholder : CAB.text }}>
          {f < 870 ? 'Что за место, чем запоминается, кому подойдёт' : typed(LED_TEXT, f, 870, 935)}
          {f >= 870 && Math.floor(f / 8) % 2 === 0 && <span style={{ display: 'inline-block', width: 2, height: 21, background: CAB.ink, marginLeft: 1, verticalAlign: -4 }} />}
        </div>
      </FieldCard>
    </CabScreen>
  );
  const ledScroll = kf(f, [[1292, 0], [1368, 1500], [1460, 1500], [1530, 3200]]);
  const cabLayer = (
    <>
      <div style={{ position: 'absolute', inset: 0, transform: `translateX(${-30 * toCards}%)` }}><LeadsScreen callScale={press(f, 580)} /></div>
      {toCards > 0 && f < 808 && <div style={{ position: 'absolute', inset: 0, transform: `translateX(${(1 - toCards) * 100}%)` }}><MyCardsScreen saved={f >= 700 ? 13 : 12} plus={plus} thumb="venues/led/hero-main.webp" /></div>}
      {f >= 792 && f < 866 && <Slide f={f} at={792}>{editor}</Slide>}
      {f >= 850 && f < 961 && <Slide f={f} at={850}>{desc}</Slide>}
      {f >= 945 && f < 1212 && <Slide f={f} at={945}>{photos}</Slide>}
      {f >= 1196 && f < 1290 && <Slide f={f} at={1196} from={-1}>{editor}</Slide>}
      {/* готовый сайт-презентация: страница LЁD листается */}
      {f >= 1264 && (
        <div style={{ position: 'absolute', inset: 0, background: BRAND.cream, transform: `translateY(${(1 - prog(f, 1264, 1286, easeInOut)) * 100}%)` }}>
          <Img src={S('ui/venue-led-long.jpg')} style={{ position: 'absolute', left: 0, top: -ledScroll, width: SCREEN_W }} />
        </div>
      )}
    </>
  );
  const swap = prog(f, 484, 502, easeInOut);
  const screen = (
    <>
      {f < 502 && <div style={{ position: 'absolute', inset: 0, transform: `translateX(${-30 * swap}%)` }}>{siteLayer}</div>}
      {f >= 484 && <div style={{ position: 'absolute', inset: 0, transform: `translateX(${(1 - swap) * 100}%)` }}>{cabLayer}</div>}
    </>
  );

  // ——— над стеклом ———
  const tBook = kf(f, [[370, 0], [384, 1], [392, 1], [400, 0]]);
  const tSend = kf(f, [[436, 0], [450, 1], [460, 1], [468, 0]]);
  const tLead = kf(f, [[532, 0], [550, 1], [610, 1], [626, 0]]);
  const tInt = kf(f, [[670, 0], [688, 1], [770, 1], [784, 0]]);
  const tAdd = kf(f, [[962, 0], [976, 1], [986, 1], [994, 0]]);
  const tPill = kf(f, [[1072, 0], [1084, 1], [1110, 1], [1120, 0]]);
  const tSubmit = kf(f, [[1212, 0], [1224, 1], [1256, 1], [1264, 0]]);
  const tSearch = kf(f, [[1374, 0], [1392, 1], [1446, 1], [1460, 0]]);
  const island = kf(f, [[290, 0], [304, 1], [346, 1], [358, 0]]);
  const islandUp = kf(f, [[306, 0], [322, 1], [338, 1], [350, 0]]);
  const cab = f >= 484;
  const lifted = (
    <>
      <Lift rect={pad(R.bookBtn)} t={tBook} z={260} grow={0.45} radius={999}>
        <div style={{ transform: `scale(${press(f, 388)})` }}><Crop src="ui/venue-villa-barvikha.png" r={pad(R.bookBtn)} /></div>
        <Tap x={R.bookBtn.w / 2} y={R.bookBtn.h / 2} at={388} />
      </Lift>
      <Lift rect={pad(R.sendBtn)} t={tSend} z={240} grow={0.22} radius={999}>
        <div style={{ transform: `scale(${press(f, 456)})` }}><Crop src="ui/booking.png" r={pad(R.sendBtn)} /></div>
        <Tap x={R.sendBtn.w / 2} y={R.sendBtn.h / 2} at={456} />
      </Lift>
      {cab && (
        <>
          <Lift rect={LEAD_RECT} t={tLead} z={200} grow={0.04} radius={24} dy={-20}>
            <LeadCard callScale={press(f, 580)} />
            <Tap x={18 + 86} y={18 + 52 + 14 + 24} at={580} />
          </Lift>
          <Lift rect={INTEREST_RECT} t={tInt} z={200} grow={0.04} radius={24}>
            <InterestSheet saved={f >= 700 ? 13 : 12} plus={plus} />
          </Lift>
          <Lift rect={ADD_RECT} t={tAdd} z={240} grow={0.2} radius={999}>
            <div style={{ transform: `scale(${press(f, 984)})` }}><AddDisk /></div>
            <Tap x={28} y={24} at={984} />
          </Lift>
          <Lift rect={PILL_RECT} t={tPill} z={240} grow={0.12} radius={22}><ProgressPill pct={pct} /></Lift>
          <Lift rect={SUBMIT_RECT} t={tSubmit} z={220} grow={0.1} radius={999}>
            <div style={{ position: 'relative' }}>{submit}<Tap x={SUBMIT_RECT.w / 2} y={SUBMIT_RECT.h / 2} at={1228} /></div>
          </Lift>
          <Lift rect={SEARCH_RECT} t={tSearch} z={260} grow={0.1} radius={22}><SearchCard /></Lift>
        </>
      )}
    </>
  );
  const islandEl = (
    <div style={{ transform: `translateZ(${islandUp * 160}px) scale(${1 + islandUp * 0.12})`, transformStyle: 'preserve-3d' }}>
      <IslandPill t={island} w={280} h={56}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: 16, fontWeight: 500 }}>
          <svg width={20} height={20} viewBox="0 0 24 24"><path d={HEART} fill="#fff" /></svg>Добавлено в избранное
        </span>
      </IslandPill>
    </div>
  );

  // ——— логотип ———
  const logoIn = prog(f, 2, 26);
  const logoOut = prog(f, 34, 52, easeInOut);
  const endIn = prog(f, 1584, 1608);
  const iconTop = L.wide ? L.text.y + 150 : L.text.y + 360;

  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse 70% 55% at ${(L.phone.cx / L.W) * 100}% ${(L.phone.cy / L.H) * 100}%, ${th.glow}, ${th.bg} 75%)`, overflow: 'hidden' }}>
      {f < 54 && (
        <AbsoluteFill style={{ display: 'grid', placeItems: 'center' }}>
          <Logo src={S('logo-unicase.svg')} width={760} color={ink} style={{ opacity: logoIn * (1 - logoOut), transform: `scale(${(0.9 + 0.1 * logoIn) * (1 + 0.5 * logoOut)})` }} />
        </AbsoluteFill>
      )}

      {f >= 60 && f < 1582 && <Phone3D pose={pose} lifted={lifted} island={islandEl} dark={th.d > 0.5}>{screen}</Phone3D>}

      <Words text="Свадебный каталог Москвы и области" from={76} to={128} ink={ink} />
      <Words text="Здесь пары собирают свою свадьбу" from={198} to={266} ink={ink} />
      <Words text="Сохраняют понравившиеся" sub="площадки и специалистов" from={272} to={362} ink={ink} />
      <IconRow f={f} from={300} to={362} ink={ink} top={iconTop} left={L.text.x} size={L.wide ? 76 : 96} />
      <Words text="И оставляют заявку" from={368} to={474} ink={ink} />
      <Words text="Заявка приходит в ваш кабинет" from={504} to={632} ink={ink} />
      <Words text="Вы видите интерес каждой пары" sub="Просмотры, сохранения, заявки — вся статистика" from={642} to={786} ink={ink} />
      <Words text="Добавьте вашу карточку" from={796} to={848} ink={ink} />
      <Words text="Расскажите о себе в свободной форме" from={856} to={942} ink={ink} />
      <Words text="Прикрепите ссылку на Яндекс Диск" sub="Все фото загрузятся сами" from={950} to={1192} ink={ink} />
      <Words text="Ваша страница — ваша презентация" from={1272} to={1368} ink={ink} />
      <Words text="Её найдут в Яндексе и Google" from={1374} to={1458} ink={ink} />
      <Words text="А мы её продвигаем" sub="Лента главной, подборки в блоге, каталог и фильтры" from={1464} to={1552} ink={ink} />

      {f >= 1582 && (
        <AbsoluteFill style={{ display: 'grid', placeContent: 'center', justifyItems: 'center', gap: L.wide ? 56 : 72, color: ink, fontFamily: BRAND.sans }}>
          <Logo src={S('logo-unicase.svg')} width={760} color={ink} style={{ opacity: endIn, transform: `scale(${0.94 + 0.06 * endIn})` }} />
          <div style={{ opacity: prog(f, 1600, 1622), transform: `translateY(${(1 - prog(f, 1600, 1622)) * 30}px)`, display: 'grid', justifyItems: 'center', gap: 28 }}>
            <div style={{ height: 104, padding: '0 56px', borderRadius: 999, border: `2px solid ${ink}`, display: 'grid', placeItems: 'center', fontSize: 44, fontWeight: 500 }}>Разместиться бесплатно</div>
            <div style={{ fontSize: 36, fontWeight: 500 }}>wed-secrets.ru/profi</div>
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
