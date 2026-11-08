import { Config } from '@remotion/cli/config';

// Облачная сессия: браузер уже стоит (/opt/pw-browsers/chromium), свой Remotion не качаем.
// Локально переменную не задаём — Remotion возьмёт свой.
if (process.env.REMOTION_CHROME) Config.setBrowserExecutable(process.env.REMOTION_CHROME);
Config.setVideoImageFormat('jpeg');
Config.setCodec('h264');
// фото и шрифты сайта — из его же папок, без копий
Config.setPublicDir('./public');
