// @ts-check
import { defineConfig } from 'astro/config';

// Локально сайт живёт в корне (base = '/'), на GitHub Pages — в подпапке репозитория.
// Значения приходят из окружения сборки (см. .github/workflows/pages.yml),
// чтобы дев-режим и продакшн-домен не зависели от превью-хостинга.
export default defineConfig({
  site: process.env.SITE_URL || undefined,
  base: process.env.SITE_BASE || '/',

  // Корень раздела «Специалисты» (/moskva/podryadchiki/) — живая страница-хаб
  // с плитками групп (pages/moskva/podryadchiki/index.astro). Редиректа
  // с него в первый каталог быть не должно: он перекрывает страницу.
});
