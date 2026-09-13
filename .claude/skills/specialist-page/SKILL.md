---
name: specialist-page
description: Конвейер «строка гугл-таблицы → карточка подрядчика» для WED Secrets (фотограф, ведущий, декоратор и остальные 19 категорий). Использовать, когда просят завести подрядчика/специалиста из таблицы, «сверстать визитку», «наполнить карточку подрядчика по яндекс-диску». Один заход оркестратора на подрядчика: скачать диск скриптом, пережать, контактный лист, JSON, проверка скриптом, сборка. Субагентов не запускать.
---

# specialist-page — карточка подрядчика

Вход: строка второй вкладки таблицы заказчика (ФИО · текстовое описание ·
сайт · ссылка на материалы (Яндекс.Диск с фото и текстом) · готово?).
Выход: `src/data/specialists/<категория>/<slug>.json` + фото в
`src/assets/specialists/<категория>/<slug>/` + портрет в
`src/assets/specialists/<категория>/avatars/<slug>.webp`. JSON подхватывается
сам: карточка появляется в каталоге категории, визитка по
`/moskva/podryadchiki/<категория>/<slug>/`.

**Бюджет — один заход оркестратора без субагентов** (вывод из аудита
площадок, см. `venue-page` → «Экономия»): материалов у подрядчика мало,
текст короткий, нечего делегировать. Ориентир: два скрипта, один
контактный лист, один JSON, `verify`, сборка.

## Шаг 0 — материалы (скрипты)

```
node --dns-result-order=ipv6first scripts/fetch-yadisk.mjs <ссылка на диск> research/specialists/<slug>/raw
node scripts/prep-photos.mjs research/specialists/<slug>
magick montage research/specialists/<slug>/photos/p*.webp -thumbnail 200x200 -set label '%t' -tile 10x -geometry +4+4 -pointsize 14 research/_sheets/<slug>.jpg
magick research/_sheets/<slug>.jpg -resize 1800x research/_sheets/<slug>.jpg
```

`fetch-yadisk` качает и `.docx/.pdf/.txt`? Нет — только фото и видео. Текст
с диска (описание, прайс) забрать отдельно: если это документ, скачать по
ссылке `file` из листинга API (`curl -L`), перевести в текст
(`pandoc` / `python -c "import docx"`), положить в
`research/specialists/<slug>/notes.md` вместе с текстом из таблицы, дословно.

Текст описания в таблице → `notes.md` как есть. Сайт/соцсети подрядчика,
если есть, — одна страница через `firecrawl_scrape` markdown в `site.md`;
без сайта ничего не искать.

## Шаг 1 — категория и slug

Категория — из `SPECIALIST_CATEGORIES` в `src/data/specialists.ts` (19 штук):
organizatory, koordinatory, vedushchie, dekoratory, fotografy, videografy,
rils-meikery, keitering, konditery, stilisty, dj, kaver-gruppy, vokalisty,
muzykanty, speceffekty, arenda-zvuka, arenda-sveta, horeografy, animatory, shou.
Снимает и фото, и видео — `categorySlug: 'fotografy'` + `alsoCategories: ['videografy']`,
визитка одна.

slug — фамилия/имя латиницей, как `leshakovy`, `anton-volkov`.

**Фильтры категории.** Значения `filters` — только из
`FILTERS_BY_CATEGORY[категория]` (закрытые списки, `verify` роняет чужие).
Сейчас фильтры есть у vedushchie, fotografy (=videografy), dekoratory.
Другая категория — сначала завести `<КАТЕГОРИЯ>_FILTERS` по образцу
`FOTOGRAFY_FILTERS` (пол · цена · локация · опыт · стиль/жанр · тип услуги)
и прописать в `FILTERS_BY_CATEGORY`; без этого каталог категории соберётся
без полосы чипов.

## Шаг 2 — кадры

По контактному листу (один Read). Выбираем:

- `avatar` — лицо подрядчика, квадрат. Если на диске есть портрет — кроп
  по голове и плечам: `magick <файл> -gravity north -crop 1:1 +repage
  -resize 800x800 research/specialists/<slug>/avatar.webp`. Нет портрета —
  поле не ставим, компонент Avatar сам нарисует инициалы. **Лицо из
  ростового свадебного кадра не кроить** (даёт грудь, не лицо).
- `portrait` — тот же портрет целиком, в блок «О нас». Только вместе с avatar.
- `photos` — 12–40 работ, `[0]` главный (портрет-ориентация: первый экран
  карточки 4:5). Вертикальные первыми, горизонтальные хвостом в конце
  (в доску главной они не идут, см. `lib/gallery`). Битые (`broken`) и
  кадры уже 1200 px — не брать.
- Видео с диска (`.mov/.mp4`) в этот заход не заводим — правила в VIDEO.md,
  отдельная задача; оставить в `raw`.

## Шаг 3 — JSON (тип `Specialist`, образец — `leshakovy` в `specialists.ts`, строки ~996–1080)

```json
{
  "slug": "", "categorySlug": "", "category": "Фотографы", "alsoCategories": [],
  "name": "Имя Фамилия",
  "avatar": "/specialists/<кат>/avatars/<slug>.webp",
  "portrait": "/specialists/<кат>/<slug>/portrait.webp",
  "photos": ["/specialists/<кат>/<slug>/gal/p07.webp", "…"],
  "tagline": "одна строка до 48 знаков, что делает и чем отличается",
  "bio": "2–3 абзаца от первого лица, если подрядчик писал о себе сам (тогда aboutTitle «О нас»/«Обо мне»), иначе в третьем и «О фотографе»",
  "gender": "м | ж | pair",
  "priceFrom": 6000, "priceNote": "если цены нет — почему и от чего зависит",
  "experienceYears": 8,
  "cities": [], "styles": [],
  "filters": { "gender": "ж", "city": ["цао", "mo"], "experience": "5-10", "style": ["reportage"], "serviceType": ["full-day"] },
  "packageIncludes": ["что входит, словами подрядчика, 5–8 пунктов"],
  "aboutTitle": "О нас",
  "quote": "предложение от подрядчика: цена/как считается/с чего начать, 1–2 предложения",
  "offers": [{ "title": "3–6 слов", "text": "1–2 предложения" }]
}
```

Правила текста те же, что у площадок (`venue-page` → «Текст»): тон
спокойный и конкретный, без «уникальных эмоций» и «незабываемых моментов»
(`verify` роняет штампы), жирности и капса нет, цифры — только из
`notes.md`/`site.md`, ` ` после коротких предлогов. `rating`/`reviews`
не ставим: у реального подрядчика демо-звёзд нет. `offers` — 4–8 карточек,
каждая про одну конкретную вещь из материалов подрядчика, а не общие
достоинства; нет материала на карточку — не выдумывать, оставить меньше.

## Шаг 4 — проверка и сборка

```
node scripts/verify-specialist.mjs <категория> <slug>
node scripts/place-specialist-photos.mjs <категория> <slug>
npx astro build      # визитка /moskva/podryadchiki/<кат>/<slug>/ и карточка в каталоге
```

Потом одно чтение JSON глазами оркестратора: повторы кадров, tagline
не дублирует bio, offers не пересказывают packageIncludes.

Коммит и `git push origin master` — деплой сам (около минуты), сайт
закрыт от поисковиков.

## Что ломалось

- (дописывать после каждого прогона)
- (13.09, Сухорада) Диск на сотни файлов и гигабайты (4 ГБ у ведущего,
  1,2 ГБ у фотографа) целиком не качать — памяти и времени нет. Сначала
  листинг API (`?public_key=…&path=/Фото&limit=200&preview_size=600x`):
  у каждого файла есть `preview`, берётся без токена. Из превью — контактный
  лист, оригиналы (`/download?public_key=…&path=…`) только для отобранных
  25–40 кадров. Скрипты-однодневки для этого — `research/specialists/<slug>/*.mjs`.
- Тексты (`.txt/.docx`) с диска качать тем же `/download` по `path`;
  `.docx` → `PYTHONIOENCODING=utf-8 python -c "import docx…"` (без
  переменной консоль Windows падает на эмодзи в тексте).
- Сайт на vigbo: главная пустая, суть на `/about` и `/prices` — две страницы
  вместо одной. og-картинка `/about` — не портрет автора, а свадебный кадр:
  проверять глазами, прежде чем кроить в аватар.
- `curl` до `cloud-api.yandex.net` висит, работает только node с
  `--dns-result-order=ipv6first`.
- Первая `astro build` после `place-specialist-photos` может упасть с
  `ENOENT dist/_astro/pNN.*.webp` (гонка генерации новых кадров) — просто
  повторить, второй прогон чистый.
- Одна ссылка от заказчика ≠ один подрядчик: в сообщении «архив ведущего»
  лежали три диска трёх разных людей (ведущий, фотограф, декоратор) плюс
  текст четвёртого. Сначала листинг всех дисков и тексты, потом решать, кого заводить.
