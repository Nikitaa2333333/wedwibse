---
name: specialist-page
description: Конвейер «материалы подрядчика (Яндекс.Диск, iCloud, текст из сообщения или строка гугл-таблицы) → карточка подрядчика в каталоге и запись в PocketBase» для WED Secrets — фотограф, ведущий, декоратор и остальные 19 категорий. Использовать, когда просят завести подрядчика/специалиста, «сверстать визитку», «наполнить карточку по диску», «закинуть подрядчиков в базу». Сбор материалов (диск, сайт, видео, скрипты) — Haiku-субагентом, оркестратор только отбирает кадры и пишет текст; диск целиком не качать.
---

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

**Оркестратор думает, Haiku таскает.** (Правило от 17.09, после прогона
Нирвани: оркестратор сам листал папки диска, ловил таймауты API, перезапускал
скачивания и читал вывод скриптов — и на этом улетела большая часть токенов
прогона, хотя ни одно из этих действий не требует головы.) Делим так:

- **Haiku-субагент (`model: "haiku"`) — весь сбор материалов, Фаза 0 целиком:**
  листинг диска и подпапок, `paths.json`, `yadisk-previews`, скачивание
  отобранных оригиналов (`yadisk-pick`), `prep-photos`, ролики (`yadisk-video`
  list/get, полоса кадров ffmpeg, пережатие по VIDEO.md, постер), тексты с
  диска, `firecrawl` сайта в `site.md`, `place-specialist-photos`, `pb-seed`,
  `pb-pull`. Ему же — все повторы при таймаутах и отвалившихся фонах: сеть
  до `cloud-api.yandex.net` капризная, и каждый повтор из оркестратора стоит
  контекста. Haiku получает конкретный список команд и отчитывается одной
  строкой: что скачано, что упало, куда положено. Один субагент на фазу —
  «скачай превью и сайт», потом «скачай вот эти номера и прогони prep-photos» —
  не десять мелких.
- **Оркестратор (Sonnet/Opus) — только то, где нужно решать:** один Read
  контактного листа и отбор номеров, один Read проверки аватара (если есть
  портрет), один Read полосы кадров видео (если есть ролики), текст карточки
  и JSON, чтение результата `verify`. Больше ничего дорогого: не листать диск,
  не читать выводы скачиваний, не ждать фоновых задач.

Воркфлоу (`Workflow`) по-прежнему не нужен: цепочка линейная, двух-трёх
последовательных Haiku-заходов хватает.

Что нельзя:

- качать папку диска целиком (у подрядчиков 1–4 ГБ: превью → отбор → 25–40 оригиналов);
- `sleep`-циклы и опрос фоновых задач;
- Firecrawl куда-либо, кроме сайта самого подрядчика (2–3 страницы: главная, «обо мне», «цены»);
- рисовать `rating`/`reviews` — у реального подрядчика демо-звёзд нет;
- цифры, которых нет в `notes.md`/`site.md` (`verify` роняет);
- кроить аватар из ростового свадебного кадра (даёт грудь, не лицо).

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

### Яндекс.Диск (основной путь)

```
node --dns-result-order=ipv6first scripts/yadisk-previews.mjs <slug> <ссылка> [paths.json]
   # печатает имя папки, качает превью 600px в prev/, собирает research/_sheets/<slug>.jpg
node --dns-result-order=ipv6first scripts/yadisk-pick.mjs <slug> <ссылка> "004 017 …"
   # оригиналы только отобранных → raw/
node scripts/prep-photos.mjs research/specialists/<slug>
   # webp 2400–3000 px q88, манифест photos.json (id, пропорция, размер, broken)
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

### iCloud (`share.icloud.com/photos/<id>`)

Это не общий альбом (sharedstreams — 404 на всех партициях), а CloudKit-шара
из «Фото». Без браузера не берётся: `public/records/resolve` отдаёт зону,
число кадров и **владельца** (`share.participants[owner].userIdentity` —
имя берём, почту нет), но `shared/records/query` требует
`publicAccessAuthToken`, который выдаёт только веб-приложение. Путь:

1. Открыть ссылку в локальном Chrome (chrome-devtools MCP, `new_page`).
2. `list_network_requests` → взять URL запроса `shared/records/query` с токеном.
3. `evaluate_script` в странице: запросы `CPLAssetAndMasterByAssetDateWithoutHiddenOrDeleted`
   с `startRank` от N−1 вниз **шагом 16** (в ответе на 32 записи — 16 пар
   asset+master), собрать `resJPEGMedRes` (превью) и `resOriginalRes`
   (оригинал, `${f}` → `public.jpeg`/`public.heic`) → `masters.json`.
4. Превью и оригиналы качать node-скриптом (`research/specialists/family-dekor/{getmed,getorig}.mjs`
   как образец). Ссылки живут около суток. Firecrawl страницу не рендерит.

### Google Drive

Папка — `mcp__claude_ai_Google_Drive__search_files`/`download_file_content`,
либо `scripts/fetch-urls.mjs` по прямым ссылкам (см. `venue-page`, Fish Point).

### Сайт подрядчика

Есть сайт — `firecrawl_scrape` markdown, `onlyMainContent`, `excludeTags: nav/header/footer`.
На конструкторах (vigbo и т.п.) главная пустая, суть на `/about` и `/prices` —
две-три страницы, не одна. Всё в `site.md`. Без сайта ничего не искать.
og-картинка «Об авторе» — обычно свадебный кадр, не портрет: проверять глазами.

### Видео (тем же заходом, не «потом»)

```
node --dns-result-order=ipv6first scripts/yadisk-video.mjs <slug> <ссылка> list
node --dns-result-order=ipv6first scripts/yadisk-video.mjs <slug> <ссылка> get paths.json
ffmpeg -v error -y -i video/x.mov -vf "fps=1/3.5,scale=180:-1,tile=7x1" -frames:v 1 video/strip.jpg   # полоса кадров, один Read
```

Берём 2–3 самых лёгких файла (у фотографа 36–47 МБ) или промо ведущего;
гигабайтные исходники не качать. Пережатие — команда из VIDEO.md **со звуком**
(`-c:a aac -b:a 96k`, в данных `sound: true`), 8 секунд, 720×1080, 1–2 МБ.
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
- `photos` — 25–40 работ, `[0]` главный (портрет-ориентация, первый экран 4:5).
  Вертикальные первыми, горизонтальные хвостом (в доску главной они не идут).
  После `prep-photos` пробежать по `photos.json`: `broken` (TIFF под маской
  jpg с телефона) и `width < 1200` (скрины, webp из соцсетей) выкинуть —
  контактный лист их не выдаёт.

## Фаза 3 — JSON и текст

Образец — `leshakovy` в `specialists.ts` (~996–1080) и готовые JSON
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
./pb/pocketbase.exe serve --http 127.0.0.1:8090 --dir pb/pb_data --migrationsDir pb/pb_migrations   # если не запущен
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

`git add` JSON, `src/assets/specialists/<кат>/<slug>`, аватар, ролики с
постерами, `data/reels.ts`, правки скилла → коммит → `git push origin master`
(деплой сам, около минуты). Перед пушем `git pull --rebase`: параллельные
сессии часто пушат в master и могут захватить твои файлы в свой коммит.
Не коммитить: `research/`, `pb/pb_data`, чужие незакоммиченные правки.

Итог пользователю: список визиток с URL, что осталось без имени/портрета/цены,
что не завели (гигабайтные видео, iCloud без браузера).

## Что ломалось (дописывать после каждого прогона)

- (13.09) `fetch-yadisk.mjs` целиком на 482 файла / 4 ГБ упал по таймауту
  на первом файле и ничего не сохранил → превью + точечные оригиналы,
  скрипты `yadisk-*`.
- (13.09) Каталог ведущих читал только демо-массив `VEDUSHCHIE`, JSON-ведущий
  в сетку не попадал — починено (`SPECIALISTS_BY_CATEGORY.vedushchie`,
  «Цена по запросу» без `priceFrom`).
- (13.09) `verify` искал бакеты фильтров («35–50», «15+») в сырье — починено.
- (14.09) Ролики: имена файлов на диске с пробелами и «!» ломали ffmpeg —
  `yadisk-video` переименовывает при скачивании.
- (14.09) iCloud-шара: путь через локальный Chrome, см. Фазу 0.
- (14.09) Две студии декора перепутаны местами по имени — потому что имя
  не читали из папки диска. Теперь имя папки печатает `yadisk-previews`.
- (14.09) `pb-seed-specialists` + `pb-pull` для подрядчиков: круг сходится
  (4 подрядчика, 135 фото, 7 роликов, 2 аватара).
- (17.09, Нирвани) Сеть: с включённым VPN (ZoogVPN) IPv6 нет вовсе, и
  `--dns-result-order=ipv6first` + Git Bash дают таймаут на всё подряд —
  скрипты `yadisk-*` запускать из PowerShell БЕЗ этого флага; сперва
  `Test-NetConnection cloud-api.yandex.net -Port 443`, чтобы понять, какой
  стек живой. Фоновые скачивания (`run_in_background`) не переживают
  обрыв сессии — Haiku пусть ждёт их в foreground.
- (17.09) Корневая папка диска без фото, только подпапки, и у папки
  пробел в конце имени («ФОТО ») — только через `paths.json`, и пробел
  сохранить. `yadisk-previews` без paths.json тогда падает на montage
  с «превью: 0».
- (17.09) Ролик «как я работаю» с титрами внизу почти на каждой секунде:
  вместо поиска чистого куска — кроп верхней части кадра
  `crop=880:1320:100:0` (2:3, титры на ~72 % высоты остаются за
  кадром), затем `scale=720:1080`. Постер тем же кропом.
- (17.09) Портрета на диске нет — аватар вырезан из кадра бэкстейдж-ролика
  (1080p, лицо анфас, квадрат 700 px, без апскейла). На кружок годится,
  в `portrait` такое не ставим.
- (17.09) `pb-pull --all` переписывает и `src/data/venues/*.json`
  (перестановка ключей) — откатывать `git checkout -- src/data/venues`
  вместе со специалистами, а свой новый JSON после pb-pull пересобирать
  в исходном порядке ключей (копию делать ДО pb-pull, не после).
