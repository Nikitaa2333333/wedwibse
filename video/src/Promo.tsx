// ЗАГОТОВКА: одна сцена «кадр площадки + фраза», чтобы проверить шрифты,
// фото и рендер. Настоящий ролик — по брифу из следующего чата.
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, Easing } from 'remotion';
import { BRAND, EASE_OUT } from './brand';

const ease = Easing.bezier(...EASE_OUT);

export const Promo = () => {
  const f = useCurrentFrame();
  const photo = interpolate(f, [0, 150], [1.06, 1], { easing: ease, extrapolateRight: 'clamp' });
  const text = interpolate(f, [20, 50], [0, 1], { easing: ease, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: BRAND.cream, color: BRAND.chocolate }}>
      {/* текст на фото не кладём (закон сайта): кадр сверху, фраза на бумаге снизу */}
      <div style={{ height: 1350, overflow: 'hidden' }}>
        <Img src={staticFile('venues/river-loft/gal/g13.webp')} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${photo})` }} />
      </div>
      <div style={{ padding: '64px 72px', opacity: text, transform: `translateY(${(1 - text) * 24}px)` }}>
        <div style={{ fontFamily: BRAND.serif, fontSize: 112, lineHeight: 1.02 }}>Площадка для вашей свадьбы</div>
        <div style={{ fontFamily: BRAND.sans, fontSize: 40, marginTop: 28 }}>wed-secrets.ru</div>
      </div>
    </AbsoluteFill>
  );
};
