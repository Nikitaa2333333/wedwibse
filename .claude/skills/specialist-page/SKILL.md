---
name: specialist-page
description: Конвейер «материалы подрядчика (Яндекс.Диск, iCloud, текст из сообщения или строка гугл-таблицы) → карточка подрядчика в каталоге и запись в PocketBase» для WED Secrets — фотограф, ведущий, декоратор и остальные 19 категорий. Использовать, когда просят завести подрядчика/специалиста, «сверстать визитку», «наполнить карточку по диску», «закинуть подрядчиков в базу». Сбор материалов (диск, сайт, видео, скрипты) — Haiku-субагентом, оркестратор только отбирает кадры и пишет текст; диск целиком не качать.
---

> **Сайт из базы (05.11.2026).** Сайт берёт подрядчиков из PocketBase, а не из JSON в git:
> запись `pb-seed-specialists` — это и есть публикация, карточка появляется на сайте через
> ~20 секунд без пересборки (фото, которых ещё нет в сборке, сайт берёт из базы по `photoIndex`).
> JSON в git остаётся исходником конвейера и запасным вариантом. Правка текста в JSON → снова
> `pb-seed-specialists <slug>`, иначе на сайте останется старое.

# specialist-page — карточка подрядчика

Зеркало `venue-page` для людей, а не залов. Отличия по существу: материалов
мало и они одинаковые (папка фото + один текст), поэтому фаз исследования и
фактов нет — сбор делает Haiku, отбор и текст оркестратор. Итог каждого прогона:

| Что | Где |
| --- | --- |
| Данные карточки | `src/data/specialists/<категория>/<slug>.json` (тип `Specialist`) |
| Галерея и портрет | `src/assets/specialists/<категория>/<slug>/gal/pNN.webp`, `…/portrait.webp` |
| Аватар | `src/assets/specialists/<категория>/avatars/<slug>.webp` |
| Ролики | `public/reels/<slug>-<что>.mp4` + постер `src/assets/reels/<slug>-<что>.webp`, запись в `src/data/reels.ts` |
| Сырьё (в `.gitignore`) | `research/specialists/<slug>/` — `notes.md`, `site.md`, `prev/`, `raw/`, `photos/`, `video/` |
| База | запись коллекции `specialists` в PocketBase (`scripts/pb-seed-specialists.mjs`) |

JSON подхватывается сам: карточка встаёт в каталог категории
(`/moskva/podryadchiki/<категория>/`) и визитку `/moskva/podryadchiki/<категория>/<slug>/`,
ролики — в первый экран визитки и в ленту главной. Код не трогаем.

## Роли и бюджет

Оркестратор думает, Haiku таскает: весь сбор материалов (Фаза 0), повторы при таймаутах, `prep-photos`, `place-specialist-photos`, `pb-seed` — Haiku-субагент одним-двумя заходами; себе — отбор кадров по контактному листу, текст и JSON, чтение `verify`. Не качать диск целиком, не делать `sleep`-циклов, не брать цифры вне `notes.md`/`site.md`, не рисовать `rating`/`reviews`. Полный текст правил и история — `references/lessons.md`.

## Другие источники и журнал ошибок

iCloud, Google Drive, сайт подрядчика и журнал «Что ломалось» — в `references/lessons.md`. Новая поломка — дописывать туда.

## Вход

Заказчик отдаёт материалы тремя способами, и **одна ссылка ≠ один подрядчик**:
в одном сообщении «архив ведущего» лежали три диска трёх разных людей плюс
текст четвёртого. Первый шаг всегда — листинг всех ссылок и чтение всех
текстов, потом решение, кого заводить и в какую категорию.

1. **Строка второй вкладки гугл-таблицы** (ФИО · описание · сайт · материалы · готово?) —
   читается `mcp__claude_ai_Google_Drive__read_file_content` по id таблицы.
2. **Ссылки сообщением** — Яндекс.Диск (основной случай), iCloud, Google Drive.
3. **Текст сообщением** — в `notes.md` дословно.

Название подрядчика часто лежит **в имени корневой папки диска**
(`yadisk-previews` печатает его первой строкой: «Meriyadecor (Евгению)» =
Maria Decor) и в текстах на диске (`обо мне.docx`, `условия работы.txt`).
Карточку «без имени» не заводить — сначала папка, тексты, владелец шары.

## Фаза 0 — материалы

### Яндекс.Диск — через сервер (основной путь с 05.10.2026)

Диск качает VPS в России, ноутбук только забирает готовое (зачем и как
устроено — `docs/CONTENT-PIPELINE.md`). Через VPN тот же диск тянется минутами
и рвётся; с сервера листинг 3 ГБ — 7 секунд, превью 51 кадра — 6 секунд.
Запускать из Git Bash:

```
bash scripts/research.sh list    <ссылка>                 # всё дерево диска рекурсивно, с весом
bash scripts/research.sh preview <slug> <ссылка>          # превью 600px → research/specialists/<slug>/prev/ + index.tsv
magick montage $(ls research/specialists/<slug>/prev/*.jpg | sort) -tile 9x -geometry 150x150+3+3 research/_sheets/<slug>.jpg
bash scripts/research.sh pick    <slug> "004 017 …"       # скачивает И пережимает на сервере → photos/ + photos.json
                                                          # (ссылку помнит сам; prep-photos больше не нужен)
```

- **Сначала `list`, а не вывод субагента.** 05.10 Haiku доложил «на диске
  только видео», а `list` показал папку «/Фото» на 46 свадебных кадров
  и пять портретов — карточку чуть не выпустили без фото и аватара.
- С 06.10.2026 `pick` пережимает кадры на сервере (`prep-photos-server.mjs`,
  sharp, под `nice`): Матрешка — 51 кадр за 42 с, 208 МБ оригиналов
  превратились в 27 МБ webp, на ноутбук за 5 с вместо ~4 минут.
  Оригиналы остаются на сервере — `research.sh pull <slug> raw`, если
  понадобятся (вырезать аватар из полного кадра и т.п.).
- Ролики — тоже на сервере (с 06.10.2026): там лежит статический ffmpeg
  `/srv/wed-research/bin/ffmpeg`. `research.sh all <slug> <url> --only=video`
  кладёт исходники в `/srv/wed-research/out/<slug>/`, там же полоса кадров
  (`fps=1/8,scale=100:-1,tile=14x2`) и пережатие командой docs/VIDEO.md под
  `nice -n 19 … -threads 2` — сайт на том же сервере не должен заметить.
  На ноутбук `scp` тянет только полосы и готовые ролики по 2–8 МБ, а не
  исходники по 300 МБ – 1,6 ГБ. Образец — WHY NOT в истории чата 06.10
  и `research/reel-map.json` (src с префиксом `server:`).

Старый путь с ноутбука (запасной, если сервер недоступен):

```
node --dns-result-order=ipv6first scripts/yadisk-previews.mjs <slug> <ссылка> [paths.json]
node --dns-result-order=ipv6first scripts/yadisk-pick.mjs <slug> <ссылка> "004 017 …"
```

- Стек сети зависит от того, включён ли VPN: без VPN IPv4 до
  `cloud-api.yandex.net` висит и нужен `--dns-result-order=ipv6first`;
  с VPN (ZoogVPN) IPv6 нет вовсе, и флаг всё ломает — запускать из
  PowerShell без него. Сначала `Test-NetConnection cloud-api.yandex.net
  -Port 443`, потом выбирать. Повторы при таймаутах — в самих скриптах.
- Подпапки диска («/Фото», «/мое портфолио») — в `paths.json` массивом,
  не в argv: кириллицу в аргументах Git Bash доносит битой, API отвечает 404.
- У ведущего на диске обычно ещё «отзывы» (сотни скринов) и «движухи» —
  в лист не брать, только портфолио и «с молодожёнами».
- Тексты (`.txt/.docx/.pdf`) `yadisk-*` не качают. Их — по тому же API
  `/download?public_key=…&path=…` (пример — `research/specialists/dekor/docs.mjs`),
  `.docx` → `PYTHONIOENCODING=utf-8 python -c "import docx;…"` (без переменной
  консоль Windows падает на эмодзи).

### Видео (тем же заходом, не «потом»)

```
node --dns-result-order=ipv6first scripts/yadisk-video.mjs <slug> <ссылка> list
node --dns-result-order=ipv6first scripts/yadisk-video.mjs <slug> <ссылка> get paths.json
ffmpeg -v error -y -i video/x.mov -vf "fps=1/3.5,scale=180:-1,tile=7x1" -frames:v 1 video/strip.jpg   # полоса кадров, один Read
```

**Максимум 5 роликов на подрядчика** (заказчик, 24.09.2026). Исключение —
Reels-мейкеры (`rils-meikery`): у них ролик и есть работа, им больше
(25.09.2026; точное число уточнить у заказчика, если не названо). Отбор — по обложкам роликов (поле
`preview` в листинге публичного ресурса API), качаем только выбранные,
весь набор не тянем. У фотографа обычно 2–3 самых лёгких файла (36–47 МБ)
или промо ведущего; гигабайтные исходники не качать. Пережатие — команда из docs/VIDEO.md **со звуком**
(`-c:a aac -b:a 96k`, в данных `sound: true`), до 60 секунд (короче — целиком),
720×1080, до 8 МБ. Точку старта и исходник — в `research/reel-map.json`.
Горизонтальное промо режется центром `crop=ih*2/3:ih`; куски с титрами на
кадре не брать. Постер — из оригинала на той же секунде. Запись в
`data/reels.ts` с `author: <slug>`, проверка `node scripts/verify-video.mjs`.

## Фаза 1 — категория, slug, фильтры

Категория — из `SPECIALIST_CATEGORIES` в `src/data/specialists.ts` (19 штук):
organizatory, koordinatory, vedushchie, dekoratory, fotografy, videografy,
rils-meikery, keitering, konditery, stilisty, dj, kaver-gruppy, vokalisty,
muzykanty, speceffekty, arenda-zvuka, arenda-sveta, horeografy, animatory, shou.
Снимает и фото, и видео — `categorySlug: 'fotografy'` + `alsoCategories: ['videografy']`.

slug — фамилия или бренд латиницей: `suhorada`, `galkin`, `maria-decor`, `push-decor`.

**Фильтры** — только значения из `FILTERS_BY_CATEGORY[категория]` (закрытые
списки, `verify` роняет чужие). Сейчас есть у vedushchie, fotografy (=videografy),
dekoratory. Другая категория — сначала завести `<КАТЕГОРИЯ>_FILTERS` по образцу
`FOTOGRAFY_FILTERS` и прописать в `FILTERS_BY_CATEGORY`, иначе каталог
соберётся без полосы чипов. Значения фильтров — ключи, не текст: в сырье
их не ищем, но и не выдумываем (не оговорена локация — ставим Москву + МО,
но не «выезд за МО»).

**Ведущему** заполнять и `filters` (для сетки каталога), и прямые поля
`age`, `hasOwnDJ`, `ceremonyMaster`, `hasEquipment`, `formats`, `languages`
(для визитки) — у него своя страница каталога.

## Фаза 2 — кадры (один Read контактного листа)

- `avatar` — лицо подрядчика, квадрат. Портрет ищем в портфолио ведущего
  (там он сам), у остальных — отдельный кадр «владелица у стены», og «Об авторе».
  Кроп: `magick <файл> -auto-orient -gravity north -crop 1:1 +repage -resize "800x800>" avatar.webp`,
  при лице внизу кадра — `-crop WxH+0+Y` руками, проверить одним Read.
  Маленький портрет (600–700 px) годится на аватар без апскейла, но не в `portrait`.
  Нет портрета — поле не ставим, `Avatar` рисует инициалы.
- `portrait` — тот же портрет целиком в блок «О нас», только вместе с avatar;
  положить в `research/specialists/<slug>/photos/portrait.webp`.
- `photos` — до 50 работ (норма — 50, см. выше), `[0]` главный (портрет-ориентация, первый экран 4:5).
  Вертикальные первыми, горизонтальные хвостом (в доску главной они не идут).
  После `prep-photos` пробежать по `photos.json`: `broken` (TIFF под маской
  jpg с телефона) и `width < 1200` (скрины, webp из соцсетей) выкинуть —
  контактный лист их не выдаёт.

## Фаза 3 — JSON и текст

**С 08.10.2026 главный текст визитки — поле `story`, а не `bio/offers/quote`**
(CLAUDE.md, «Карточки»; docs/CHARACTER.md). Порядок работы:

1. Разметить исходник: какие у подрядчика разделы, в каком порядке, под
   какими заголовками, первое лицо или нет, что он сам выделил (жирное,
   отдельная строка, эмодзи-акцент → `lead`).
2. Переписать в `story.json` (массив StorySection) один к одному: свои
   разделы не досочинять, факты не выкидывать. Убрать только призывы
   («звоните», «переходите в соцсети»), контакты, ссылки; поправить
   опечатки и капс. Формы раздела — DESIGN.md §3: тарифы — `tariffs`
   (карточки), меню — `kind: 'menu'`, участники — `items[].photo`;
   выделения (`mark`) и тёмных разделов (`tone`) у подрядчиков нет.
3. `node scripts/story-put.mjs <кат>/<slug> story.json` → `verify-specialist`
   → `node scripts/text-coverage.mjs` (по его исходнику ≥ 95 %, остаток —
   только отзывы, меню сайта, личные пометки).

Поля `bio/tagline/offers/packageIncludes/quote` по-прежнему заполняются:
по ним живут карточка каталога, «Похожие», SEO-описание. Образцы story —
`stilisty/nazarova`, `vedushchie/solnechnaya`, `vedushchie/galkin`.

Образец старых полей — `leshakovy` в `specialists.ts` (~996–1080) и готовые JSON
(`fotografy/suhorada`, `vedushchie/galkin`, `dekoratory/maria-decor`, `dekoratory/push-decor`).

```json
{
  "slug": "", "categorySlug": "", "category": "Фотографы", "alsoCategories": [],
  "name": "Имя Фамилия или бренд",
  "avatar": "/specialists/<кат>/avatars/<slug>.webp",
  "portrait": "/specialists/<кат>/<slug>/portrait.webp",
  "photos": ["/specialists/<кат>/<slug>/gal/p07.webp", "…"],
  "tagline": "до 48 знаков: что делает и чем отличается",
  "bio": "2–3 абзаца. От первого лица, если подрядчик писал о себе сам (aboutTitle «О нас»/«Обо мне»), иначе в третьем («О фотографе»)",
  "gender": "м | ж | pair",
  "priceFrom": 40000, "priceNote": "нет цены — от чего зависит; priceFrom = за 6 часов, нижняя граница, только из сырья",
  "experienceYears": 17,
  "cities": [], "styles": [],
  "filters": { "…": "только значения FILTERS_BY_CATEGORY" },
  "packageIncludes": ["5–8 пунктов словами подрядчика"],
  "aboutTitle": "О нас",
  "quote": "1–2 предложения: цена/как считается/с чего начать",
  "offers": [{ "title": "3–6 слов", "text": "1–2 предложения" }]
}
```

Текст — правила `venue-page` → «Текст»: спокойно и конкретно, без «уникальных
эмоций», жирности и капса; цифры только из `notes.md`/`site.md`; ` ` после
коротких предлогов. `offers` — 4–8 карточек, каждая про одну конкретную вещь
из материалов (тарифы, оборудование, производство, порядок работы); нет
материала — карточек меньше, не выдумывать. Тарифы с сайта — в `offers`
с ценами, `packageIncludes` — что входит.

## Фаза 4 — проверка и сборка

```
node scripts/verify-specialist.mjs <категория> <slug>      # структура, фильтры, файлы, числа, типографика
node scripts/place-specialist-photos.mjs <категория> <slug> # research → src/assets
node scripts/verify-video.mjs                              # если добавляли ролики
npx astro build
```

`verify` числа ищет только в текстовых полях (`filters/age/cities/styles/formats/languages`
исключены). Первая сборка после раскладки новых кадров может упасть с
`ENOENT dist/_astro/pNN.*.webp` — гонка генерации, повторить.

Потом одно чтение JSON глазами: повторы кадров, tagline не дублирует bio,
offers не пересказывают packageIncludes.

## Фаза 5 — PocketBase (обязательно, не «потом»)

База — источник правды, файлы в `src/` — её снимок (см. `pb/README.md`).
Карточка не считается заведённой, пока не лежит в коллекции `specialists`:

```
bash scripts/pb-tunnel.sh   # база на VPS с 06.10.2026 — туннель на 127.0.0.1:8090; локальный pocketbase.exe не запускать
node scripts/pb-seed-specialists.mjs <slug> [--publish]   # upsert записи + фото + аватар + ролики, photoIndex
node scripts/pb-pull.mjs --all                             # проверка круга: файлы должны совпасть, git status чистый
```

- Запись: плоские колонки `slug, categorySlug, alsoCategories, name, tagline,
  citySlug, priceFrom, filters` + `page` (весь объект `Specialist`) +
  файлы `photos` (галерея, портрет), `avatar`, `reels` + `photoIndex`
  (имя файла в PB → исходный путь; PB переименовывает файлы).
- Новая запись — `draft`, `--publish` ставит `published` (тогда `pb-pull`
  без `--all` её видит). Пока сайт собирается из локальных JSON, статус
  можно не трогать; при переходе на сборку из базы — публиковать.
- `pb-pull` переписывает JSON с ключами по алфавиту — это шум, после
  проверки круга `git checkout -- src/data/specialists`.
- Схема коллекции — `pb/pb_migrations/1757700000_init_catalog.js`
  (специалисты там с самого начала) + `photoIndex` во второй миграции.
  Новое поле — новая миграция рядом, не правка старой.

## Фаза 6 — коммит

Ролики — сначала на сервер: `bash scripts/media-push.sh` (в git mp4 не идут,
24.09.2026, см. docs/VIDEO.md). Потом `git add` JSON, `src/assets/specialists/<кат>/<slug>`,
аватар, постеры роликов, `data/reels.ts`, правки скилла → коммит → `git push origin master`
(деплой сам, около минуты). Перед пушем `git pull --rebase`: параллельные
сессии часто пушат в master и могут захватить твои файлы в свой коммит.
Не коммитить: `research/`, `pb/pb_data`, чужие незакоммиченные правки.

Итог пользователю: список визиток с URL, что осталось без имени/портрета/цены,
что не завели (гигабайтные видео, iCloud без браузера).
