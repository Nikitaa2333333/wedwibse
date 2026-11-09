#!/usr/bin/env bash
# Фото, шрифты и знаки сайта — в video/public ссылками, без копий (папка в .gitignore).
# Снимки интерфейса (public/ui) делает scripts/capture.mjs, это не ссылка.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p public
ln -sfn ../../src/assets/venues public/venues
ln -sfn ../../src/assets/specialists public/specialists
ln -sfn ../../src/assets/reels public/reels
ln -sfn ../../src/assets/profi public/profi
ln -sfn ../../public/fonts public/fonts
cp ../public/logo-unicase.svg public/logo-unicase.svg  # файлом: бандлер Remotion ссылки на файлы не отдаёт
cp ../public/logo-tag.svg public/logo-tag.svg
echo "ok: video/public → src/assets, public/fonts и логотип сайта"
