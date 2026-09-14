# База каталога — PocketBase

Стек из ТЗ: Astro (статика) + PocketBase (база, файлы, админка) на VPS
Timeweb. Здесь — локальный экземпляр для разработки и схема, которая
едет на сервер.

## Что где

| Что | Где |
| --- | --- |
| Бинарник (не в git) | `pb/pocketbase.exe` — `pocketbase_<ver>_windows_amd64.zip` с GitHub |
| Схема коллекций | `pb/pb_migrations/*.js` — версионируется, накатывается при старте |
| Данные и файлы (не в git) | `pb/pb_data/` |
| Доступ | `.env`: `PB_URL`, `PB_ADMIN_EMAIL`, `PB_ADMIN_PASSWORD` |
| Админка | `http://127.0.0.1:8090/_/` |

## Запуск локально

```
./pb/pocketbase.exe serve --http 127.0.0.1:8090 --dir pb/pb_data --migrationsDir pb/pb_migrations
```

Первый суперпользователь: `./pb/pocketbase.exe superuser upsert <email> <pass> --dir pb/pb_data`.

## Поток данных

```
таблица заказчика ─(skill venue-page)─▶ src/data/venues/<slug>.json + src/assets/venues/<slug>/
                                                 │
                                   node scripts/pb-seed.mjs [slug] [--publish]
                                                 ▼
                                      PocketBase: venues.page (JSON) + venues.photos (файлы)
                                      + плоские колонки под фильтры (type, capacity, checkFrom…)
                                                 │
                                   node scripts/pb-pull.mjs   (перед astro build)
                                                 ▼
                                      те же JSON + фото в src/ → astro:assets пережимает → статика
```

База — источник правды; JSON и фото в `src/` — её снимок на момент
сборки. Правка в админке (цена, статус, новый кадр) → следующий деплой
подтянет. Сайт собирается и без базы: без `PB_URL` pull пропускается,
и в дело идут файлы, лежащие в репозитории.

Подрядчики идут тем же кругом: `skill specialist-page` →
`src/data/specialists/<кат>/<slug>.json` + фото/аватар в `src/assets/specialists/…`
+ ролики в `public/reels/` → `node scripts/pb-seed-specialists.mjs [slug] [--publish]`
→ коллекция `specialists` (`page`, `filters`, файлы `photos`/`avatar`/`reels`,
`photoIndex`) → тот же `pb-pull` возвращает всё в `src/` и `public/reels/`.

Четыре площадки, записанные объектами в `src/data/venues.ts`
(River Loft, Лесная Роса, Spark Hall, LЁD), заливаются
`pb-seed --legacy`; обратно pull их не пишет, чтобы не задвоить страницу.
Перевод их в JSON — отдельный шаг, когда база станет боевой.

## Коллекции

- `venues` — площадка: `page` (весь объект Venue, тело страницы блоками),
  `photos`, `docs`, плоские колонки фильтров, `status` (draft → review →
  published → archived). Публично видны только published.
- `venue_reviews` — отзывы с премодерацией (`approved`).
- `specialists` — подрядчики, та же схема: `page` + `avatar` + `photos` + `reels`.
- `leads` — заявки: `kind` client/vendor, создать может кто угодно (форма
  на сайте), читать — только суперпользователь; `consent` обязателен (152-ФЗ).
- `landing_pages` — посадочные: путь, тексты над и под списком, фильтр.

Изменение схемы — новая миграция (`./pb/pocketbase.exe migrate create <name>`),
старую не править.

## Сервер (когда переносим в бой)

PocketBase — один бинарник Linux на том же VPS (`193.124.47.78`), systemd-сервис
под своим пользователем, nginx проксирует `api.wed-secrets.ru` → `127.0.0.1:8090`,
SSL Let's Encrypt. Бэкап `pb_data` ежедневно (встроенный `Settings → Backups`
плюс копия на объектное хранилище). Деплой сайта получает `PB_URL` и
доступ суперпользователя секретами GitHub Actions и делает `pb-pull` перед сборкой.
