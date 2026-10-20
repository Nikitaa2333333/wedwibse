#!/usr/bin/env bash
# Референсы интерфейсов с Mobbin для кабинета подрядчика (CABINET-UX.md §4).
# Mobbin отдаёт страницы разделов без входа, а картинки экранов лежат на
# bytescale.mobbin.com — скрипт собирает их в листы по 14 экранов.
#   bash scripts/mobbin-refs.sh [раздел ...]
# Разделы — хвост адреса mobbin.com/explore/mobile/…, например:
#   screens/edit  flows/editing-updating  flows/adding-creating
#   ui-elements/stacked-list  "screens?app=airbnb"
# Итог — research/refs/<раздел>-N.jpg (research/ в .gitignore).
set -euo pipefail
out=research/refs; mkdir -p "$out"
sections=("$@"); [ ${#sections[@]} -eq 0 ] && sections=(screens/edit flows/editing-updating flows/adding-creating "screens?app=airbnb")
for s in "${sections[@]}"; do
  name=$(echo "$s" | tr '/?=' '---')
  tmp=$(mktemp -d)
  curl -sS -L -m 30 "https://mobbin.com/explore/mobile/$s" -o "$tmp/page.html"
  grep -o 'app_screens/[a-f0-9-]*\.png' "$tmp/page.html" | sort -u | head -28 > "$tmp/ids.txt"
  i=0
  while read -r p; do
    i=$((i+1))
    curl -sS -L -m 30 -o "$tmp/s$(printf %02d $i).png" \
      "https://bytescale.mobbin.com/FW25bBB/image/mobbin.com/prod/content/$p?f=png&w=360&q=60&fit=shrink-cover" &
  done < "$tmp/ids.txt"
  wait
  n=0
  for chunk in $(seq 1 14 $i); do
    n=$((n+1))
    files=$(ls "$tmp"/s*.png | sed -n "${chunk},$((chunk+13))p")
    montage $files -geometry 360x780+4+4 -tile 7x "$out/$name-$n.jpg"
  done
  echo "$name: $i экранов → $out/$name-*.jpg"
  rm -rf "$tmp"
done
