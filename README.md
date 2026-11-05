# WED Secrets

Свадебный агрегатор площадок и подрядчиков Москвы и МО (wed-secrets.ru): Astro (статика + серверное превью) и PocketBase.

```sh
npm install
npm run dev -- --host 127.0.0.1 --port 4400   # дев-сервер
npm run build                                   # полная сборка (долго: режет все фото)
```

- Законы проекта — `CLAUDE.md`; план и статус — `ROADMAP.md`; карта — `docs/map/index.html`.
- База и хуки кабинета — `pb/README.md`. Деплой — пушем в master (`docs/DEPLOY.md`).
- Остальные документы — `docs/`, указатель в конце `CLAUDE.md`.
