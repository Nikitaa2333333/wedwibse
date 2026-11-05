// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

// Откуда превью берёт фото анкеты (pages/profi/prevyu): на боевом — сам сайт,
// при локальной проверке — тестовая база (PREVIEW_FILES_URL=http://127.0.0.1:8097).
const previewFiles = new URL(process.env.PREVIEW_FILES_URL || 'https://wed-secrets.ru');

// Локально сайт живёт в корне (base = '/'), на GitHub Pages — в подпапке репозитория.
// Значения приходят из окружения сборки (см. .github/workflows/pages.yml),
// чтобы дев-режим и продакшн-домен не зависели от превью-хостинга.
export default defineConfig({
  site: process.env.SITE_URL || undefined,
  base: process.env.SITE_BASE || '/',

  // Сайт остаётся статикой (output по умолчанию): все страницы собираются
  // заранее. Адаптер нужен ровно одной странице — превью карточки до
  // одобрения (/profi/prevyu/, `prerender = false`): её рисует маленький
  // серверный процесс на VPS из анкеты в базе (STAGE2.md, 03.11).
  adapter: node({ mode: 'standalone' }),
  // фото анкеты в превью приходят из базы по ссылке — разрешаем ровно её файлы
  image: {
    remotePatterns: [{
      protocol: previewFiles.protocol.replace(':', ''),
      hostname: previewFiles.hostname,
      ...(previewFiles.port ? { port: previewFiles.port } : {}),
      pathname: '/api/files/**',
    }, {
      // кадры превью анкеты (pb_hooks: previewFile) — без ключа подрядчика в адресе
      protocol: previewFiles.protocol.replace(':', ''),
      hostname: previewFiles.hostname,
      ...(previewFiles.port ? { port: previewFiles.port } : {}),
      pathname: '/api/wed/preview-file',
    }],
  },

  // Корень раздела «Специалисты» (/moskva/podryadchiki/) — живая страница-хаб
  // с плитками групп (pages/moskva/podryadchiki/index.astro). Редиректа
  // с него в первый каталог быть не должно: он перекрывает страницу.

  // Модерация переехала в админку (24.10.2026) — первые ссылки уже ушли заказчику.
  redirects: {
    '/profi/moderaciya': '/profi/admin/moderaciya',
    '/profi/moderaciya/[id]': '/profi/admin/moderaciya/[id]',
  },
});
