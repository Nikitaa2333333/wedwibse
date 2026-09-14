# Аудит скорости и мусора — 14.09.2026

Замер: PageSpeed Insights (Lighthouse) по живому сайту + три прохода по коду
(рендер/HTML, мёртвый код, лишние фичи). Десктоп везде 89–99 — проблема
только на телефоне. Пересчитывать после правок: `pagespeed-audit` по тем же
четырём адресам, скрипт сам покажет «было → стало».

| Страница | Perf (mobile) | LCP | Вес |
| --- | --- | --- | --- |
| `/` | 82 | 3,9 s | 1,5 МБ |
| `/moskva/ploshchadki/` | 78 | 4,2 s | 2,0 МБ |
| `/moskva/ploshchadki/forest-dew/` | 80 | 4,0 s | 2,1 МБ |
| `/moskva/podryadchiki/vedushchie/anton-volkov/` | 87 | — | 0,4 МБ |

TBT = 0 и CLS = 0 везде: JS (≤28 КБ) и CSS (~20 КБ) не проблема.
LCP держат шрифт, первый кадр ленты и объём HTML.

**Сделано 14.09.2026** (пп. 1–5 таблицы ниже и весь раздел «Мусор», кроме
токенов `global.css`): шрифт самохостится (`public/fonts/onest-*.woff2`,
вариативный, preload кириллицы); главная режется потолком
`BOARD_TILE_LIMIT` в `gallery.ts` и первые две плитки идут с
`fetchpriority="high"` (168 → 56 `<img>`, 186 → 72 КБ); иконки — внешний
спрайт `public/icons.svg` из `gen-icons.mjs`, `Icon.astro` рисует `<use>`
(карточка due-to-love 210 → 127 КБ); nginx отдаёт `public/` с кешем 30 дней
(`_astro` — год, HTML — no-cache, `X-Robots-Tag` сохранён). Не сделано:
п. 6 (Lenis), п. 7 (SiteHeader), п. 8 (сцены), токены в `global.css`.

## 1. Скорость — что реально держит LCP

| # | Что | Где | Цена | Правка |
| --- | --- | --- | --- | --- |
| 1 | Google Fonts блокирует рендер **750 мс на каждой странице**. Грузятся веса 200/300 (в проекте нет — токены 500/600/700), а 700 для `--w-head-lg` не грузится вовсе: h1 рисуется синтетическим жирным | `Layout.astro:43` | −0,7 с FCP/LCP везде | Самохостинг 3 файлов woff2 (500/600/700) в `public/fonts`, `@font-face` + `font-display: swap` в `global.css`, `<link rel=preload as=font>` на корпусной вес. Снять `preconnect` на google |
| 2 | Главная отдаёт **весь каталог в HTML**: `PhotoBoard` → `PhotoMasonry` без `limit`, `collectTiles()` берёт по 8 плиток с каждой площадки и каждого из 35 подрядчиков — 168 `<img>`, 186 КБ HTML, растёт линейно с каталогом | `PhotoBoard.astro:28`, `gallery.ts:384-409`, `PER_CARD_TILES` в `gallery.ts:259` | парсинг/layout на слабом телефоне, LCP | Потолок плиток на первую отдачу (у `PhotoMasonry` `limit` уже есть, кнопка «показать все» есть) |
| 3 | LCP-кадр главной (первая плитка доски) идёт с `loading="lazy"` и без `fetchpriority` — `MasonryTile` не прокидывает `priority` в `PhotoRail` | `MasonryTile.astro:40`, `PhotoRail.astro:47-82` | Lighthouse прямо помечает | Прокинуть `priority` на первые 1–2 плитки. На карточках площадки/подрядчика уже сделано правильно |
| 4 | `Icon.astro` инлайнит полный SVG на каждый вызов: на карточке с рядом роликов 54 `<svg>` = **91 КБ из 212 КБ** HTML (`sound`+`soundOff`+`play` ≈ 6 КБ на ролик) | `Icon.astro:17`, `icons.ts:77-85`, `ReelsRow.astro:44-55` | −60…90 КБ HTML на карточках | Один `<symbol>`-спрайт в `Layout`, `Icon` рисует `<use href="#icon-…">` |
| 5 | `public/` отдаётся **без кеша**: `/venues/*.mp4`, `/reels/*.mp4`, `logo.svg` — `Cache-Control` пустой (у `_astro/*` — год) | nginx `/etc/nginx/sites-available/wedsecrets` | ролик 751 КБ перекачивается на каждой странице | `location ~* \.(mp4|webp|jpg|svg|pdf)$ { expires 30d; }` для не-`_astro` |
| 6 | Lenis импортируется на каждой странице при `SMOOTH_SCROLL = false` | `Layout.astro:85-114` | лишний запрос JS | Динамический `import('lenis')` под условием или убрать импорт до включения |
| 7 | `SiteHeader` при `display:none` рендерит DOM и вешает `resize`-обработчик на 9 страницах; `--header-h` всегда `0px` | `SiteHeader.astro:39,107-112` | мелочь | Убрать скрипт до включения шапки |
| 8 | Кадры сцен площадки шумные: `s1-park` 580 КБ, `s2-hall` 273 КБ на 1200w (исходник 1798×2400, 1,2 МБ, листва — webp q80 не жмёт) | `src/assets/venues/forest-dew/s*.webp`, `ScrollyScenes` | вес карточки площадки | Не пережимать руками (правило CLAUDE.md), но проверить `sizes` у сцен — нужен ли 1200w на 412 CSS-px |

Проверено и чисто: видео (`preload="none"`, `src` подставляет скрипт), карта
(ленивый SDK по IntersectionObserver), `IMG_WIDTHS`/`sizes`, CSS-эффекты,
`will-change`. 568 МБ `dist/_astro` — 455 кадров × ~6 ширин; это время
сборки и деплоя, не вес страницы.

## 2. Мусор — удалить

| Что | Вес | Почему |
| --- | --- | --- |
| Корень: `AQPB…mp4`, `lv_0_2026060721…mp4`, `lv_0_2026062417…mp4`, `ChatExport_2026-09-02/` | ~41 МБ | случайные файлы, не в `.gitignore` |
| `public/venues/river-loft/neewwwwwww.webp` | 2,3 МБ | 0 ссылок, едет на сервер каждым деплоем |
| `public/rl-hero-pt-5..8.webp`, `public/rl-og-cover.jpg` | ~480 КБ | заменены на `src/assets/venues/river-loft/…` |
| `public/venues/forest-dew/logo.png`, пустые `public/venues/stock/`, `public/venues/river-loft/gal/` | — | 0 ссылок |
| `src/pages/icons.astro` + `src/lib/icon-preview.ts` + `@iconify-json/{ph,iconoir,hugeicons}` | 245+32 строк, 3 пакета | тестовый пикер иконок, набор уже выбран (Solar зашит в `gen-icons.mjs`); страница собирается в прод как `/icons/` |
| `src/pages/karta-test.astro` | 29 строк | помечена «удалить», собирается в прод как `/karta-test/` |
| `src/lib/imageSize.ts` | 41 строка | никто не импортирует, хардкод на river-loft |
| `gsap` в `package.json` | зависимость | `grep gsap src` — пусто |
| `dueToLove` в `src/data/venues.ts:931-1165` | 234 строки | старый инлайн-черновик, площадка заведена через `venues/due-to-love.json`; комментарий «ждём фото» устарел |
| `articlesAboutVenue` (`articles.ts:392`) | — | не вызывается (`findSpecialist` из первого прохода оказался живым — его читает `reels.ts`) |
| `global.css`: токены `--tint-*` (14 шт., стр. 313-331), `--glass-*` (7 шт., 360-366, 440-442), блок `.theme-accent` (549-555) | — | фичи сняты, токены остались; `--glass-*` по CLAUDE.md оставлены «для всплывающих панелей», но ни одна их не использует |

Не мусор, но тяжёлое в git: `scripts/wordstat-out/` — 17 МБ сырых выгрузок
(переисполняется командой из `SEO.md`; кандидат в `research/`),
`public/docs/spark-hall-tech.pdf` — 9,8 МБ сырой PDF.

## 3. Фичи и дубли — решение за заказчиком

- **«Избранное» = свайп-отбор + сравнение** (`izbrannoe/index.astro` ~680 строк
  скрипта + ~400 CSS, `shortlist.ts`, `compare-facts.ts`, `swipe.ts`, `viewer.ts`
  — итого >1400 строк клиентской логики). **Решение заказчика 14.09.2026:
  оставить как есть** — это осознанный сложный механизм продукта, исключение
  из правила «клиентская логика — после дизайна». Не упрощать и не замораживать.
- **Тёмная тема** (`theme.ts` + `ThemeToggle` + ~44 строки токенов): тумблер
  стоит только на главной, в CLAUDE.md темы нет. Убрать или дать постоянное место.
- **Мозаика каталога разъехалась**: у площадок `variant(i)` инлайн на странице
  (`% 5`, `PLAIN_HEAD = 4`), у специалистов `variantOf(i)` в `specialist-card.ts`
  (`% 6`); карточка площадки не вынесена в компонент, у специалистов —
  `SpecialistGrid`. Слить в один компонент карточки каталога с ролью пропом.
- **`podryadchiki/vedushchie/index.astro` vs `[category]/index.astro`**:
  разница 15–20 строк (бакеты цены/опыта), остальные ~120 строк — копия.
- **Схема полей кадров** разная по сущностям: `venues.gallery: {src,alt,wide}[]`,
  `feed.media: string[]`, `specialists.photos: string[]`; цена —
  `specialists.priceFrom` vs `feed.checkFrom`. Свести до роста каталога.
- `pb-*.mjs` — ручные утилиты, не часть сборки; пометить в `pb/README.md`.

Живое и без дублей: все 31 компонент, `PhotoBoard→PhotoMasonry→MasonryTile`
и `PhotoRail/HeroStage/VenueHero` — композиция, не альтернативы; фильтрация
(`FilterBar/FilterSheet/filter-counts/sort`) работает по DOM-атрибутам и CSS
`order`, SEO-правило соблюдено; блог — 4 демо-статьи, каркас под SEO-схему.
