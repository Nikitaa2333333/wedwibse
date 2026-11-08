# Промо-ролики WED Secrets (Remotion)

Отдельная мастерская роликов. В сайт не входит: Astro эту папку не собирает,
на сервер она не уезжает, зависимости — свои (`video/package.json`), не сайта.

## Запуск

```bash
cd video
npm install
bash scripts/link-assets.sh          # фото и шрифты сайта — ссылками в video/public
npm run studio                       # окно Remotion Studio (локально, смотреть глазами)
npm run still                        # один кадр → out/still.png
npm run render                       # ролик → out/promo.mp4
```

В облачной сессии браузер свой не качаем — перед `still` / `render`:
`export REMOTION_CHROME=/opt/pw-browsers/chromium`. Проверено 08.11: заготовка
5 с рендерится за ~15 с, 2,6 МБ.

## Что лежит

| Файл | Что |
| --- | --- |
| `src/Root.tsx` | композиции: размер, fps, длина (сейчас `Promo` — 1080×1920, 30 к/с, 5 с) |
| `src/Promo.tsx` | ЗАГОТОВКА: одна сцена «кадр + фраза» — проверка шрифтов, фото и рендера |
| `src/brand.ts` | палитра и шрифты сайта, кривые плавности |
| `src/fonts.ts` | Onest и Cormorant из `public/fonts` сайта |
| `scripts/link-assets.sh` | `video/public/{venues,specialists,reels,fonts}` → папки сайта |
| `out/` | готовые ролики (в git не идут) |

## 3D-модель телефона

`public/models/phone.glb` — «iPhone 16 - Free», автор Wes (sketchfab.com/wimell),
https://sketchfab.com/3d-models/iphone-16-free-d58591e88a824dfd8cef0af616273b02,
лицензия Sketchfab Standard: в ролике можно, файл отдельно не распространяем — поэтому
в git его нет. Скачать GLB со страницы модели и положить по этому пути.
Модель рисует Three.js (`src/promo/model.tsx`), экран поверх — наш DOM (`phone3d.tsx`).
Без GPU рендер идёт программно (`swangle`, remotion.config.ts): ~2 с на кадр.

## Снимки сайта и раскадровка

- `npm run capture` — снимки сайта с дев-сервера (`npx astro dev --port 4327` в корне) → `public/ui/`.
- `node scripts/stills.mjs DemoVertical 100 200 …` → `out/stills/`, `python3 scripts/sheet.py DemoVertical out/sb.jpg` — лист раскадровки.

## Материал

- Фото площадок: `src/assets/venues/<slug>/…` → в ролике `staticFile('venues/<slug>/…')`.
  Площадки: river-loft, forest-dew, spark-hall, led, due-to-love, fish-point,
  otrazhenie, grebnevo, villa-barvikha, villa-dovil.
- Фото подрядчиков: `src/assets/specialists/<категория>/<slug>/…`.
- Постеры роликов ленты: `src/assets/reels/`. Сами ролики — на VPS, не в git (`docs/VIDEO.md`).
- Экраны кабинета (если ролик для подрядчиков) — снять с сайта Playwright-ом
  с `/profi/` и `/profi/moi/` (демо-режим кабинета, `src/lib/cabinet-demo.ts`).
- Тексты и факты — только с сайта и из данных карточек, цифры не выдумываем.

## Бренд: правила сайта, которые держим и в ролике

- Бумага и чернила, цветных заливок нет. Акцент `#e8592a` — точкой, не фоном кадра.
- Текст на фото не кладём и фото не затемняем: кадр отдельно, фраза на бумаге.
- Cormorant — крупные фразы; Onest — всё остальное. Капс запрещён, жирность внутри фразы тоже.
- Моушн спокойный: сдвиг, масштаб, прозрачность; плавность `EASE_OUT` / `EASE_INOUT`, linear нет.
  Без блюра, частиц, 3D, «вау» — журнальный тон, как у сайта.
- Подробно — `DESIGN.md` и скилл `site-design`.

## Инструменты сверх заготовки — по нужде, не заранее

- FFmpeg — дожать mp4 под соцсети (в облаке: `/opt/pw-browsers/ffmpeg-1011`, или пакет `ffmpeg`).
- `@remotion/transitions` — переходы между сценами (та же версия, что `remotion`).
- `@remotion/media-utils` — музыка: громкость, затухание. Трек — только с лицензией.
- Субтитры — титрами в коде; озвучку голосом на русском пока не берём (качество).

## Открытые вопросы к брифу

1. Для кого: пары (витрина) или подрядчики (зовём в кабинет, `/profi/`)?
2. Формат: вертикаль 9:16 до 30 с (соцсети) или 16:9 (сайт, презентация)?
3. Музыка: есть трек с лицензией или ролик без звука под титры?
