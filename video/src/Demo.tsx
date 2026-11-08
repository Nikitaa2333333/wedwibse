// ДЕМО ДЛЯ ЗАКАЗЧИКА — первые 32 с промо (правки Никиты 08.11.2026, раскадровка v3).
// Телефон нужен, чтобы с первых кадров было ясно: это сайт в телефоне. Но он живой,
// в 3D: прилетает, наклоняется, даёт крупный план, переворачивается в кабинет; по стеклу
// идёт блик. Главное вынимаем над стеклом (Lift): кнопка «Забронировать», «Отправить»,
// заявка, интерес пар. «Добавлено в избранное» вырастает из островка сверху.
// Пушей нет — всё идёт через сайт (Никита). Логотип — с главной (logo-unicase), в начале и в конце.
// Мелкие служебные подписи сайта в кадр не берём (capture.mjs их прячет).
import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import R from '../public/ui/rects.json';
import { BRAND } from './brand';
import { LEAD_RECT, LeadCard, LeadsScreen, INTEREST_RECT, InterestSheet, MyCardsScreen } from './promo/cabinet';
import { Tempo, easeInOut, kf, press, prog, useT } from './promo/motion';
import { IslandPill, Lift, Phone3D, Pose } from './promo/phone3d';
import { Logo, SCREEN_H, SCREEN_W, Tap, Words, useLayout, useTheme } from './promo/stage';

// Темп: Никита 08.11 — «слишком быстро, не успеваю прочитать». Ключи — в своих кадрах (960),
// TempoContext растягивает их в 1,6 раза: ролик идёт ~51 с.
const RATE = 0.625;
export const DEMO_DURATION = Math.ceil(960 / RATE);

const S = (p: string) => staticFile(p);
const HEART = 'M2 9.1371C2 14 6.01943 16.5914 8.96173 18.9109C10 19.7294 11 20.5 12 20.5C13 20.5 14 19.7294 15.0383 18.9109C17.9806 16.5914 22 14 22 9.1371C22 4.27416 16.4998 0.825464 12 5.50063C7.50016 0.825464 2 4.27416 2 9.1371Z';

const tileCY = R.feedTile.y + R.feedTile.h / 2;
const FEED_END = tileCY - SCREEN_H / 2;
const tile = { x: R.feedTile.x, y: R.feedTile.y - FEED_END, w: R.feedTile.w, h: R.feedTile.h };
const c = (r: { x: number; y: number; w: number; h: number }) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const pad = (r: { x: number; y: number; w: number; h: number }, p = 0) => ({ x: r.x - p, y: r.y - p, w: r.w + 2 * p, h: r.h + 2 * p });

/** кусок снимка экрана — для элемента, вынутого над стеклом */
const Crop: React.FC<{ src: string; r: { x: number; y: number; w: number; h: number } }> = ({ src, r }) => (
  <div style={{ position: 'relative', width: r.w, height: r.h, overflow: 'hidden' }}>
    <Img src={S(src)} style={{ position: 'absolute', left: -r.x, top: -r.y, width: SCREEN_W, height: SCREEN_H }} />
  </div>
);

export const Demo: React.FC = () => (
  <Tempo rate={RATE}><DemoScene /></Tempo>
);

const DemoScene: React.FC = () => {
  const f = useT();
  const L = useLayout();
  const th = useTheme([[478, 0], [498, 1], [796, 1], [822, 0]]);
  const ink = th.ink;
  const b = L.phone.screenW / SCREEN_W;

  // ——— поза телефона ———
  const pose: Pose = {
    x: L.phone.cx,
    y: L.phone.cy + kf(f, [[54, 760], [120, 0], [122, 0], [146, 150], [188, 150], [206, 0], [366, 0], [380, L.wide ? 0 : -110], [470, L.wide ? 0 : -110], [490, 0], [790, 0], [846, 1500]]),
    s: kf(f, [[54, b * 0.72], [120, b], [122, b], [146, b * 1.9], [188, b * 1.9], [206, b * 1.02], [262, b * 1.02], [278, b * 1.5], [350, b * 1.5], [366, b * 1.1], [476, b * 1.1], [490, b * 1.02], [506, b * 1.1], [790, b * 1.1], [846, b * 0.8]]),
    rx: kf(f, [[54, 14], [120, 6], [122, 6], [146, 16], [188, 18], [206, 4], [262, 4], [278, 8], [350, 8], [366, 6], [790, 6], [846, 10]]),
    ry: kf(f, [[54, -14], [120, -9], [122, -9], [146, 7], [188, 10], [206, -4], [262, -4], [278, 9], [350, 9], [366, -9], [468, -9], [502, 9], [638, 9], [662, -9], [790, -9], [846, 6]]),
    rz: kf(f, [[54, -8], [120, -3], [122, -3], [146, -12], [188, -9], [206, 0], [262, 0], [278, -3], [350, -3], [366, 2], [638, 2], [662, -3], [790, -3], [846, -8]]),
    fx: kf(f, [[262, 195], [278, 240], [350, 240], [366, 195]]),
    fy: kf(f, [[122, 422], [146, 470], [188, 470], [206, 422], [262, 422], [278, 150], [350, 150], [366, 422]]),
  };

  // ——— экран ———
  const scroll = kf(f, [[60, 0], [120, 1200], [190, 4300], [212, FEED_END]]);
  const open = f >= 218 ? 1 : 0; // тап — и сразу полная страница, без «слайд-шоу» (Никита 08.11)
  const sheet = prog(f, 398, 420, easeInOut);
  const saved = prog(f, 285, 292);
  const cabinet = f >= 484;
  const toCards = prog(f, 640, 660, easeInOut);
  const plus = prog(f, 700, 712);

  const siteLayer = (
    <>
      {f < 248 && (
        <div style={{ position: 'absolute', inset: 0, background: BRAND.cream }}>
          <Img src={S('ui/feed.jpg')} style={{ position: 'absolute', left: 0, top: -scroll, width: SCREEN_W }} />
          <Tap x={c(tile).x} y={c(tile).y} at={215} />
        </div>
      )}
      {f >= 218 && (
        <div style={{ position: 'absolute', inset: 0 }}>
          <Img src={S('ui/venue-villa-barvikha.png')} style={{ position: 'absolute', inset: 0, width: SCREEN_W, height: SCREEN_H,
            clipPath: `inset(${tile.y * (1 - open)}px ${(SCREEN_W - tile.x - tile.w) * (1 - open)}px ${(SCREEN_H - tile.y - tile.h) * (1 - open)}px ${tile.x * (1 - open)}px round ${16 * (1 - open)}px)` }} />
          {/* сердце на кадре: нажали — залилось */}
          <svg width={26} height={26} viewBox="0 0 24 24" style={{ position: 'absolute', left: c(R.heart).x - 13, top: c(R.heart).y - 13, opacity: saved, transform: `scale(${1 + 0.6 * kf(f, [[285, 0], [290, 1], [298, 0]])})` }}>
            <path d={HEART} fill="#fff" stroke="#fff" strokeWidth={1.5} strokeLinejoin="round" />
          </svg>
          <Tap x={c(R.heart).x} y={c(R.heart).y} at={285} />
          {sheet > 0 && <Img src={S('ui/booking.png')} style={{ position: 'absolute', inset: 0, width: SCREEN_W, height: SCREEN_H, clipPath: 'inset(64px 0 0 0)', transform: `translateY(${(1 - sheet) * 790}px)` }} />}
        </div>
      )}
    </>
  );
  const cabLayer = (
    <>
      <div style={{ position: 'absolute', inset: 0, transform: `translateX(${-30 * toCards}%)` }}><LeadsScreen callScale={press(f, 580)} /></div>
      {toCards > 0 && <div style={{ position: 'absolute', inset: 0, transform: `translateX(${(1 - toCards) * 100}%)` }}><MyCardsScreen saved={f >= 700 ? 13 : 12} plus={plus} thumb="venues/led/hero-main.webp" /></div>}
    </>
  );
  // переход сайт → кабинет: без переворота ребром (грань не показываем) — кабинет въезжает сбоку
  const swap = prog(f, 484, 502, easeInOut);
  const screen = (
    <>
      {f < 502 && <div style={{ position: 'absolute', inset: 0, transform: `translateX(${-30 * swap}%)` }}>{siteLayer}</div>}
      {f >= 484 && <div style={{ position: 'absolute', inset: 0, transform: `translateX(${(1 - swap) * 100}%)`, boxShadow: '-20px 0 40px rgba(0,0,0,0.15)' }}>{cabLayer}</div>}
    </>
  );

  // ——— над стеклом ———
  const tBook = kf(f, [[370, 0], [384, 1], [392, 1], [400, 0]]);
  const tSend = kf(f, [[436, 0], [450, 1], [460, 1], [468, 0]]);
  const tLead = kf(f, [[532, 0], [550, 1], [610, 1], [626, 0]]);
  const tInt = kf(f, [[670, 0], [688, 1], [758, 1], [772, 0]]);
  const island = kf(f, [[290, 0], [304, 1], [346, 1], [358, 0]]);
  const islandUp = kf(f, [[306, 0], [322, 1], [338, 1], [350, 0]]);

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
      {cabinet && (
        <>
          <Lift rect={LEAD_RECT} t={tLead} z={200} grow={0.04} radius={24} dy={-20}>
            <LeadCard callScale={press(f, 580)} />
            <Tap x={18 + 86} y={18 + 52 + 14 + 24} at={580} />
          </Lift>
          <Lift rect={INTEREST_RECT} t={tInt} z={200} grow={0.04} radius={24}>
            <InterestSheet saved={f >= 700 ? 13 : 12} plus={plus} />
          </Lift>
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
  const endIn = prog(f, 896, 920);

  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse 70% 55% at ${(L.phone.cx / L.W) * 100}% ${(L.phone.cy / L.H) * 100}%, ${th.glow}, ${th.bg} 75%)`, overflow: 'hidden' }}>
      {f < 54 && (
        <AbsoluteFill style={{ display: 'grid', placeItems: 'center' }}>
          <Logo src={S('logo-unicase.svg')} width={760} color={ink} style={{ opacity: logoIn * (1 - logoOut), transform: `scale(${(0.9 + 0.1 * logoIn) * (1 + 0.5 * logoOut)})` }} />
        </AbsoluteFill>
      )}

      {f >= 53 && f < 850 && <Phone3D pose={pose} lifted={lifted} island={islandEl} dark={th.d > 0.5} opacity={prog(f, 53, 72)}>{screen}</Phone3D>}

      <Words text="Свадебный каталог Москвы и области" from={70} to={126} ink={ink} />
      <Words text="Здесь пары собирают свою свадьбу" from={198} to={266} ink={ink} />
      <Words text="Сохраняют понравившихся" from={272} to={362} ink={ink} />
      <Words text="И оставляют заявку" from={368} to={474} ink={ink} />
      <Words text="Заявка приходит в ваш кабинет" from={504} to={632} ink={ink} />
      <Words text="Видна вся статистика" from={642} to={784} ink={ink} />
      <Words text="Ваша карточка — следующая" from={834} to={892} ink={ink} size={150} centered />

      {f >= 894 && (
        <AbsoluteFill style={{ display: 'grid', placeContent: 'center', justifyItems: 'center', gap: L.wide ? 56 : 72, color: ink, fontFamily: BRAND.sans }}>
          <Logo src={S('logo-unicase.svg')} width={760} color={ink} style={{ opacity: endIn, transform: `scale(${0.94 + 0.06 * endIn})` }} />
          <div style={{ opacity: prog(f, 912, 934), transform: `translateY(${(1 - prog(f, 912, 934)) * 30}px)`, display: 'grid', justifyItems: 'center', gap: 28 }}>
            <div style={{ height: 104, padding: '0 56px', borderRadius: 999, border: `2px solid ${ink}`, display: 'grid', placeItems: 'center', fontSize: 44, fontWeight: 500 }}>Разместиться бесплатно</div>
            <div style={{ fontSize: 36, fontWeight: 500 }}>wed-secrets.ru/profi</div>
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
