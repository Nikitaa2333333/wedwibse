#!/usr/bin/env bash
# Фото и шрифты сайта — в video/public ссылками, без копий (папка в .gitignore).
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p public
ln -sfn ../../src/assets/venues public/venues
ln -sfn ../../src/assets/specialists public/specialists
ln -sfn ../../src/assets/reels public/reels
ln -sfn ../../public/fonts public/fonts
echo "ok: video/public → src/assets и public/fonts сайта"
