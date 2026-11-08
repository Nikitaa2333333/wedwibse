// Сцена ролика: раскладка под формат, телефон с «камерой», кинетический текст,
// касание, «вырванный» из экрана элемент. Экран телефона — в CSS px сайта (390 × 844),
// как снимки scripts/capture.mjs: координаты кнопок из rects.json ложатся один в один.
import React from 'react';
import { AbsoluteFill, interpolate, interpolateColors, useCurrentFrame, useVideoConfig } from 'remotion';
import { BRAND } from '../brand';
import { easeOut, kf, prog } from './motion';

export const SCREEN_W = 390;
export const SCREEN_H = 844;

export interface Layout {
  wide: boolean;
  W: number;
  H: number;
  phone: { cx: number; cy: number; screenW: number };
  text: { x: number; y: number; w: number; size: number };
  pull: { x: number; y: number };
}

/** Вертикаль: фраза сверху, телефон снизу. Горизонталь: фраза слева, телефон справа. */
export function useLayout(): Layout {
  const { width: W, height: H } = useVideoConfig();
  return W > H
    ? { wide: true, W, H, phone: { cx: 1400, cy: 540, screenW: 420 }, text: { x: 150, y: 540, w: 860, size: 108 }, pull: { x: 1400, y: 540 } }
    : { wide: false, W, H, phone: { cx: 540, cy: 1250, screenW: 560 }, text: { x: 90, y: 170, w: 920, size: 116 }, pull: { x: 540, y: 1150 } };
}

// ——— фон: бумага ↔ тёмная тема (кабинет) ———
export interface Theme { bg: string; ink: string }
export function useTheme(darkKeys: [number, number][]): Theme {
  const f = useCurrentFrame();
  const d = kf(f, darkKeys);
  return {
    bg: interpolateColors(d, [0, 1], [BRAND.cream, BRAND.darkPaper]),
    ink: interpolateColors(d, [0, 1], [BRAND.chocolate, BRAND.darkInk]),
  };
}

// ——— камера и телефон ———
export interface Cam { z: number; fx: number; fy: number; dx: number; dy: number }
export const CAM0: Cam = { z: 1, fx: SCREEN_W / 2, fy: SCREEN_H / 2, dx: 0, dy: 0 };

/** точка экрана (CSS px) → точка кадра */
export function toStage(L: Layout, cam: Cam, x: number, y: number) {
  const k = (L.phone.screenW / SCREEN_W) * cam.z;
  return { x: L.phone.cx + cam.dx + (x - cam.fx) * k, y: L.phone.cy + cam.dy + (y - cam.fy) * k, k };
}

export const Phone: React.FC<{ cam: Cam; children: React.ReactNode; opacity?: number }> = ({ cam, children, opacity = 1 }) => {
  const L = useLayout();
  const o = toStage(L, cam, 0, 0);
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', transform: `translate(${o.x}px, ${o.y}px) scale(${o.k})`, opacity }}>
      {/* корпус — нейтральный, без марки: смысл в интерфейсе, а не в устройстве */}
      <div style={{ position: 'absolute', left: -12, top: -12, width: SCREEN_W + 24, height: SCREEN_H + 24, borderRadius: 64, background: '#151210', boxShadow: '0 40px 80px rgba(20,14,10,0.18), 0 0 0 1.5px #3a332e inset' }} />
      <div style={{ position: 'absolute', left: 0, top: 0, width: SCREEN_W, height: SCREEN_H, borderRadius: 52, overflow: 'hidden', background: '#fff', isolation: 'isolate' }}>
        {children}
      </div>
      <div style={{ position: 'absolute', left: SCREEN_W / 2 - 52, top: 11, width: 104, height: 30, borderRadius: 15, background: '#0b0908' }} />
    </div>
  );
};

// ——— касание пальцем: кольцо расходится от точки (координаты экрана) ———
export const Tap: React.FC<{ x: number; y: number; at: number }> = ({ x, y, at }) => {
  const f = useCurrentFrame();
  if (f < at - 6 || f > at + 18) return null;
  const pre = prog(f, at - 6, at);
  const t = prog(f, at, at + 18);
  const r = 22 + 26 * t;
  return (
    <div style={{ position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: '50%', zIndex: 50,
      background: `rgba(255,255,255,${0.45 * pre * (1 - t)})`, boxShadow: `0 0 0 2px rgba(29,29,31,${0.35 * (1 - t)})`, pointerEvents: 'none' }} />
  );
};

// ——— элемент, вырванный из экрана на сцену ———
// rect — где он лежит на экране (CSS px); t — 0 на месте, 1 крупно в точке to.
export const Pull: React.FC<{ cam: Cam; rect: { x: number; y: number; w: number; h: number }; t: number; scale: number; to?: { x: number; y: number }; radius?: number; children: React.ReactNode }> = ({ cam, rect, t, scale, to, radius = 0, children }) => {
  const L = useLayout();
  if (t <= 0.001) return null;
  const from = toStage(L, cam, rect.x + rect.w / 2, rect.y + rect.h / 2);
  const dst = to ?? L.pull;
  const x = interpolate(t, [0, 1], [from.x, dst.x]);
  const y = interpolate(t, [0, 1], [from.y, dst.y]);
  const s = interpolate(t, [0, 1], [from.k, scale]);
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: rect.w, height: rect.h, transformOrigin: '50% 50%',
      transform: `translate(${x - rect.w / 2}px, ${y - rect.h / 2}px) scale(${s})`, borderRadius: radius, overflow: 'hidden',
      boxShadow: `0 ${18 * t}px ${50 * t}px rgba(20,14,10,${0.22 * t})`, zIndex: 40 }}>
      {children}
    </div>
  );
};

// ——— кинетическая фраза: слова выезжают снизу из маски и уходят вверх ———
export const Words: React.FC<{ text: string; from: number; to: number; ink: string; sub?: string; size?: number; centered?: boolean }> = ({ text, from, to, ink, sub, size, centered }) => {
  const f = useCurrentFrame();
  const L = useLayout();
  if (f < from || f > to + 4) return null;
  const fs = size ?? L.text.size;
  const words = text.split(' ');
  const word = (w: string, i: number, n: number, fsz: number, weight: number, extra = 0) => {
    const tin = prog(f, from + i * 3 + extra, from + i * 3 + extra + 16, easeOut);
    const tout = prog(f, to - 12 + (n - i) * 1.5 - 4, to + (n - i) * 1.5 - 4, easeOut);
    const y = (1 - tin) * 105 - tout * 105;
    return (
      <span key={i} style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'top', paddingBottom: fsz * 0.12, marginBottom: -fsz * 0.12, marginRight: '0.24em' }}>
        <span style={{ display: 'inline-block', transform: `translateY(${y}%)`, fontWeight: weight }}>{w}</span>
      </span>
    );
  };
 const block: React.CSSProperties = centered
    ? { left: L.text.x, top: L.H / 2, width: L.W - 2 * L.text.x, transform: 'translateY(-50%)' }
    : L.wide
    ? { left: L.text.x, top: L.text.y, width: L.text.w, transform: 'translateY(-50%)' }
    : { left: L.text.x, top: L.text.y, width: L.text.w };
  return (
    <div style={{ position: 'absolute', ...block, color: ink, fontFamily: BRAND.sans, zIndex: 30 }}>
      <div style={{ fontSize: fs, lineHeight: 1.02, letterSpacing: '-0.035em' }}>
        {words.map((w, i) => word(w, i, words.length, fs, 600))}
      </div>
      {sub && (
        <div style={{ fontSize: fs * 0.36, lineHeight: 1.25, letterSpacing: '-0.01em', marginTop: fs * 0.32 }}>
          {sub.split(' ').map((w, i, a) => word(w, i, a.length, fs * 0.36, 500, words.length * 3 + 4))}
        </div>
      )}
    </div>
  );
};

/** логотип сайта (public/logo-unicase.svg) маской: красится цветом темы */
export const Logo: React.FC<{ width: number; color: string; style?: React.CSSProperties; src: string }> = ({ width, color, style, src }) => (
  <div style={{ width, aspectRatio: '452.7 / 143.6', background: color, WebkitMaskImage: `url(${src})`, WebkitMaskSize: 'contain', WebkitMaskRepeat: 'no-repeat', WebkitMaskPosition: 'center', ...style }} />
);

export const Fill: React.FC<{ bg: string; children: React.ReactNode }> = ({ bg, children }) => (
  <AbsoluteFill style={{ background: bg, overflow: 'hidden' }}>{children}</AbsoluteFill>
);
