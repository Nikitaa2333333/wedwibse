export interface Shot {
  image: ImageMetadata;
  w: number;
  h: number;
  ratio: number; // w / h
}

// eager import через Vite: даёт готовые ImageMetadata (уже с шириной/высотой),
// а Astro прогоняет каждый файл через Sharp — resize + свой srcset на выходе,
// а не сырой webp в исходном размере.
const galImages = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/venues/river-loft/gal/*.webp',
  { eager: true }
);
const welcomeImages = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/venues/river-loft/welcome/*.webp',
  { eager: true }
);

// g1, g2, g10 — сортируем по числу, а не по строке
function naturalSort(a: string, b: string): number {
  const n = (s: string) => parseInt(s.replace(/\D/g, ''), 10) || 0;
  return n(a) - n(b);
}

function toShots(images: Record<string, { default: ImageMetadata }>): Shot[] {
  return Object.keys(images)
    .sort(naturalSort)
    .map((path) => {
      const image = images[path].default;
      return { image, w: image.width, h: image.height, ratio: image.width / image.height };
    });
}

export function collectGalShots(): Shot[] {
  return toShots(galImages);
}

export function collectWelcomeShots(): Shot[] {
  return toShots(welcomeImages);
}
