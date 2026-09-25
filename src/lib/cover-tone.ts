// ЦВЕТ ПЛАШКИ ПОД ОБЛОЖКУ — считается на сборке с самого кадра.
//
// Плитка-вход (CoverTile) растворяет нижнюю кромку обложки градиентом
// в плашку с подписью. Если плашка другого тона, чем низ кадра, вместо
// растворения видна грязная полоса (заказчик, 25.09.2026: бежевая студия
// над чернильной плашкой). Руками подбирать хекс на каждую обложку —
// не масштабируется, поэтому цвет берём из файла.
//
// Где мерить: НИЗ кадра по краям. Градиент растворяет именно нижнюю
// кромку, а там обычно пол — он темнее стены, и цвет по верху кадра
// снова давал бы шов. Середину низа не трогаем: там ноги человека.
import sharp from 'sharp';
import { join } from 'node:path';

export interface CoverTone {
  /** цвет плашки, #rrggbb */
  bg: string;
  /** тёмный фон — подпись на плашке белая (.theme-dark) */
  dark: boolean;
}

const cache = new Map<string, Promise<CoverTone>>();

/** путь как в данных: /specialists/groups/dekor.webp (лежит в src/assets) */
export function coverTone(path: string): Promise<CoverTone> {
  if (!cache.has(path)) cache.set(path, measure(path));
  return cache.get(path)!;
}

async function measure(path: string): Promise<CoverTone> {
  const img = sharp(join(process.cwd(), 'src/assets', path));
  const { width = 1, height = 1 } = await img.metadata();

  // нижние 6 % высоты, по 30 % ширины слева и справа
  const h = Math.max(1, Math.round(height * 0.06));
  const w = Math.max(1, Math.round(width * 0.3));
  const top = height - h;
  const strips = await Promise.all(
    [0, width - w].map((left) =>
      sharp(join(process.cwd(), 'src/assets', path)).extract({ left, top, width: w, height: h }).stats(),
    ),
  );
  const [r, g, b] = [0, 1, 2].map((c) => strips.reduce((sum, s) => sum + s.channels[c].mean, 0) / strips.length);

  // относительная яркость (WCAG): ниже порога — фон тёмный, подпись белая
  const lin = (v: number) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);

  const hex = (v: number) => Math.round(v).toString(16).padStart(2, '0');
  return { bg: `#${hex(r)}${hex(g)}${hex(b)}`, dark: luminance < 0.2 };
}
