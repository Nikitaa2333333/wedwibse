import { Composition } from 'remotion';
import { Promo } from './Promo';
import './fonts';

// Вертикаль 9:16, 30 к/с. Длину и сцены задаёт бриф (video/README.md).
export const Root = () => (
  <Composition id="Promo" component={Promo} durationInFrames={150} fps={30} width={1080} height={1920} />
);
