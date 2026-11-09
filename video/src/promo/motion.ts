// Ход ролика: ключевые кадры с плавностью сайта (linear не используем).
import { Easing, interpolate } from 'remotion';
import { EASE_INOUT, EASE_OUT } from '../brand';

export const easeOut = Easing.bezier(...EASE_OUT);
export const easeInOut = Easing.bezier(...EASE_INOUT);

/** 0→1 за отрезок [a, b] кадров */
export const prog = (f: number, a: number, b: number, ease = easeOut) =>
  interpolate(f, [a, b], [0, 1], { easing: ease, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

/** Ключевые кадры [[кадр, значение], …], между ними — EASE_INOUT */
export function kf(f: number, keys: [number, number][], ease = easeInOut): number {
  if (f <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [f1, v1] = keys[i];
    const [f0, v0] = keys[i - 1];
    if (f <= f1) return v0 + (v1 - v0) * ease(f1 === f0 ? 1 : (f - f0) / (f1 - f0));
  }
  return keys[keys.length - 1][1];
}

/** набор текста: сколько символов видно к кадру f */
export const typed = (text: string, f: number, a: number, b: number) =>
  text.slice(0, Math.round(text.length * interpolate(f, [a, b], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })));

/** «нажатие»: кнопка проседает и возвращается вокруг кадра t */
export const press = (f: number, t: number) => 1 - 0.06 * kf(f, [[t - 4, 0], [t, 1], [t + 6, 0]]);

// ——— темп сцены ———
// Ключи сцены пишутся в «своих» кадрах; TempoContext растягивает время (0.62 — в 1,6 раза
// медленнее). Время дробное, поэтому движение остаётся плавным, а не ступеньками.
import React, { createContext, useContext } from 'react';
import { useCurrentFrame } from 'remotion';
export const TempoContext = createContext(1);
export const useT = () => useCurrentFrame() * useContext(TempoContext);
export const Tempo: React.FC<{ rate: number; children: React.ReactNode }> = ({ rate, children }) =>
  React.createElement(TempoContext.Provider, { value: rate }, children);
