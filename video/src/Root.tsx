import { Composition } from 'remotion';
import { DEMO_DURATION, Demo } from './Demo';
import { DURATION, Promo } from './Promo';
import './fonts';

// Раскладку (вертикаль/горизонталь) выбирает сама сцена по пропорции кадра (src/promo/stage.tsx, useLayout).
// Demo — первые 30 с для заказчика (без рамки телефона, крупные детали интерфейса).
// Promo — первая полная раскадровка 46 с (v1, с телефоном) — материал для второй половины.
export const Root = () => (
  <>
    <Composition id="DemoVertical" component={Demo} durationInFrames={DEMO_DURATION} fps={30} width={1080} height={1920} />
    <Composition id="DemoWide" component={Demo} durationInFrames={DEMO_DURATION} fps={30} width={1920} height={1080} />
    <Composition id="PromoVertical" component={Promo} durationInFrames={DURATION} fps={30} width={1080} height={1920} />
    <Composition id="PromoWide" component={Promo} durationInFrames={DURATION} fps={30} width={1920} height={1080} />
  </>
);
