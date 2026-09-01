// @ts-check
import { defineConfig } from 'astro/config';

// Локально сайт живёт в корне (base = '/'), на GitHub Pages — в подпапке репозитория.
// Значения приходят из окружения сборки (см. .github/workflows/pages.yml),
// чтобы дев-режим и продакшн-домен не зависели от превью-хостинга.
export default defineConfig({
  site: process.env.SITE_URL || undefined,
  base: process.env.SITE_BASE || '/',

  // Хаб раздела «Специалисты» убран: между кнопкой и каталогом больше нет
  // промежуточного экрана с плитками направлений. Старый корневой URL
  // раздела оставляем живым (закладки, внешние ссылки) — он переносит
  // в первый каталог; в статической сборке Astro кладёт туда страницу
  // с meta refresh и canonical на цель.
  redirects: {
    '/moskva/podryadchiki': '/moskva/podryadchiki/vedushchie/',
  },
});
