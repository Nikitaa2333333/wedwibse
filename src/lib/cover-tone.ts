// ЦВЕТ ПЛАШКИ ПОД ОБЛОЖКУ — считается на сборке с самого кадра.
//
// Плитка-вход (CoverTile) растворяет нижнюю кромку обложки градиентом
// в плашку с подписью. Если плашка другого тона, чем низ кадра, вместо
// растворения видна грязная полоса (заказчик, 25.09.2026: бежевая студия
// над чернильной плашкой). Руками подбирать хекс на каждую обложку —
// не масштабируется, поэтому цвет берём из файла.
//
// Где мерить: ВСЯ нижняя кромка кадра. Градиент растворяет именно её,
// а там обычно пол — он темнее стены, и цвет по верху кадра снова давал
// бы шов. Мерить только углы пробовали: у декора в углах тёмные цветы,
// среднее уходило темнее реального края, и под светлой кромкой вставала
// тёмная плашка (25.09.2026).
import sharp from 'sharp';
import { join } from 'node:path';

export interface CoverTone {
  /** цвет плашки, #rrggbb */
  bg: string;
  /** тёмный фон — подпись на плашке белая (.theme-dark) */
  dark: boolean;
}

/** пропорция окна кадра в CoverTile (.ctile__cover { aspect-ratio: 4 / 5 }) */
const FRAME_RATIO = 4 / 5;

const cache = new Map<string, Promise<CoverTone>>();

/** путь как в данных: /specialists/groups/dekor.webp (лежит в src/assets) */
export function coverTone(path: string): Promise<CoverTone> {
  if (!cache.has(path)) cache.set(path, measure(path));
  return cache.get(path)!;
}

async function measure(path: string): Promise<CoverTone> {
  const img = sharp(join(process.cwd(), 'src/assets', path));
  const { width = 1, height = 1 } = await img.metadata();

  // Мерим у нижнего края ВИДИМОЙ части: плитка показывает кадр в окне
  // 4:5 с object-fit: cover, и кадр выше этой пропорции обрезается
  // поровну сверху и снизу. Низ файла тогда за кадром — у декора там
  // тёмная полоса, и плашка по ней выходила темнее видимой кромки.
  const shown = Math.min(height, Math.round(width / FRAME_RATIO));
  const bottom = height - Math.round((height - shown) / 2);
  const h = Math.max(1, Math.round(shown * 0.04));
  const strip = await sharp(join(process.cwd(), 'src/assets', path))
    .extract({ left: 0, top: bottom - h, width, height: h })
    .stats();
  const [r, g, b] = [0, 1, 2].map((c) => strip.channels[c].mean);

  // относительная яркость (WCAG): ниже порога — фон тёмный, подпись белая
  const lin = (v: number) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);

  const hex = (v: number) => Math.round(v).toString(16).padStart(2, '0');
  return { bg: `#${hex(r)}${hex(g)}${hex(b)}`, dark: luminance < 0.2 };
}
