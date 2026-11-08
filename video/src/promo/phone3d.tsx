// Телефон в 3D (CSS 3D, без библиотек): корпус с толщиной, блик по стеклу, мягкая тень,
// повороты по трём осям. Экран — в CSS px сайта (390 × 844). Элементы интерфейса можно
// приподнять над стеклом (Lift) — они выходят к зрителю в перспективе, как у Apple.
import React from 'react';
import { BRAND } from '../brand';
import { SCREEN_H, SCREEN_W } from './stage';

export interface Pose {
  x: number; y: number; // где в кадре стоит точка фокуса экрана
  s: number; // px кадра на 1 CSS px экрана
  rx: number; ry: number; rz: number; // градусы
  fx: number; fy: number; // точка экрана (CSS px), которая стоит в (x, y)
}

const EDGE = 5; // слоёв корпуса: тонкая грань, на малых поворотах почти не видна
const BEZEL = 12;
const R_OUT = 64;
const R_SCREEN = 52;

export const Phone3D: React.FC<{ pose: Pose; children: React.ReactNode; lifted?: React.ReactNode; island?: React.ReactNode; opacity?: number; dark?: boolean; perspective?: number }> = ({ pose, children, lifted, island, opacity = 1, dark, perspective = 2600 }) => {
  const { x, y, s, rx, ry, rz, fx, fy } = pose;
  // блик ходит по стеклу вслед за поворотом
  const glare = 50 + ry * 2.2 + rx * 0.8;
  const W = SCREEN_W + BEZEL * 2;
  const H = SCREEN_H + BEZEL * 2;
  return (
    <div style={{ position: 'absolute', inset: 0, perspective, perspectiveOrigin: `${x}px ${y}px`, opacity }}>
      {/* тень на «полу»: под телефоном, без поворота */}
      <div style={{ position: 'absolute', left: x - (fx - SCREEN_W / 2) * s - SCREEN_W * s * 0.42, top: y + (SCREEN_H - fy) * s * 0.96, width: SCREEN_W * s * 0.84, height: 70 * s,
        borderRadius: '50%', background: dark ? 'rgba(0,0,0,0.55)' : 'rgba(69,50,42,0.22)', filter: `blur(${36 * s}px)`, transform: `rotate(${rz}deg)` }} />
      <div style={{ position: 'absolute', left: 0, top: 0, transformStyle: 'preserve-3d',
        transform: `translate3d(${x}px, ${y}px, 0) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale3d(${s}, ${s}, ${s}) translate3d(${-fx}px, ${-fy}px, 0)` }}>
        {/* корпус: слои с отступом по глубине — на повороте видна грань */}
        {Array.from({ length: EDGE }, (_, i) => (
          <div key={i} style={{ position: 'absolute', left: -BEZEL, top: -BEZEL, width: W, height: H, borderRadius: R_OUT,
            transform: `translateZ(${-(i + 1) * 1.4}px)`, background: `linear-gradient(${120 + ry}deg, #9a948f, #1c1917 30%, #c9c3bd 50%, #1c1917 70%, #6e6862)` }} />
        ))}
        {/* лицевая рамка */}
        <div style={{ position: 'absolute', left: -BEZEL, top: -BEZEL, width: W, height: H, borderRadius: R_OUT, background: '#0d0b0a',
          boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.18), inset 0 0 0 4px #1a1614' }} />
        {/* экран */}
        <div style={{ position: 'absolute', left: 0, top: 0, width: SCREEN_W, height: SCREEN_H, borderRadius: R_SCREEN, overflow: 'hidden', transform: 'translateZ(0.5px)', background: '#fff', isolation: 'isolate' }}>
          {children}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 60,
            background: `linear-gradient(118deg, rgba(255,255,255,0) ${glare - 28}%, rgba(255,255,255,0.20) ${glare}%, rgba(255,255,255,0) ${glare + 22}%)` }} />
        </div>
        {/* островок; может вырасти в плашку (island) */}
        <div style={{ position: 'absolute', left: SCREEN_W / 2, top: 11, transform: 'translate(-50%, 0) translateZ(1px)', transformStyle: 'preserve-3d' }}>
          {island ?? <div style={{ width: 104, height: 30, borderRadius: 15, background: '#000' }} />}
        </div>
        {/* приподнятые над стеклом элементы */}
        <div style={{ position: 'absolute', left: 0, top: 0, transformStyle: 'preserve-3d' }}>{lifted}</div>
      </div>
    </div>
  );
};

/** элемент, приподнятый над экраном: t 0 — лежит на стекле, 1 — вышел к зрителю */
export const Lift: React.FC<{ rect: { x: number; y: number; w: number; h: number }; t: number; z?: number; grow?: number; radius?: number; children: React.ReactNode; dx?: number; dy?: number }> = ({ rect, t, z = 180, grow = 0.18, radius = 24, children, dx = 0, dy = 0 }) => {
  if (t <= 0.001) return null;
  return (
    <div style={{ position: 'absolute', left: rect.x, top: rect.y, width: rect.w, height: rect.h, borderRadius: radius,
      transform: `translate3d(${dx * t}px, ${dy * t}px, ${z * t}px) scale(${1 + grow * t})`,
      boxShadow: `0 ${30 * t}px ${70 * t}px rgba(20,14,10,${0.28 * t}), 0 0 0 ${1.5 * t}px rgba(255,255,255,${0.7 * t})` }}>
      <div style={{ width: '100%', height: '100%', borderRadius: radius, overflow: 'hidden' }}>{children}</div>
    </div>
  );
};

/** островок, выросший в чёрную плашку с текстом (t 0 — обычный островок) */
export const IslandPill: React.FC<{ t: number; children: React.ReactNode; w?: number; h?: number }> = ({ t, children, w = 300, h = 60 }) => {
  const ww = 104 + (w - 104) * t;
  const hh = 30 + (h - 30) * t;
  return (
    <div style={{ width: ww, height: hh, borderRadius: hh / 2, background: '#000', color: '#fff', display: 'grid', placeItems: 'center', overflow: 'hidden',
      boxShadow: t > 0 ? `0 ${10 * t}px ${30 * t}px rgba(0,0,0,${0.3 * t})` : 'none' }}>
      <div style={{ opacity: Math.max(0, (t - 0.55) / 0.45), transform: `scale(${0.85 + 0.15 * t})`, whiteSpace: 'nowrap', fontFamily: BRAND.sans }}>{children}</div>
    </div>
  );
};
