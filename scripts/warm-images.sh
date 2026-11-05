#!/usr/bin/env bash
# Прогрев нарезки фото (/_image) после выкладки — 05.11.2026.
#
# Страницы каталога рисует служба wedsecrets-ssr, кадры для них режет она же
# по первому запросу (~0,7 с на кадр), nginx запоминает результат на 30 дней
# (кэш wedimg). На холодном кэше страница с сотней кадров давала пачку
# параллельных нарезок, и 05.11 служба упиралась в MemoryMax=400M (OOM).
# Здесь кадры режутся заранее и строго по одному.
#
# Запускается НА СЕРВЕРЕ (деплой: ssh … 'bash -s' < scripts/warm-images.sh),
# чтобы фото не гонять по медленному каналу раннер → VPS. Уже нарезанное
# отвечает из кэша мгновенно — повторный прогон почти бесплатный.
set -u
SITE="${SITE:-https://wed-secrets.ru}"
PAUSE="${PAUSE:-0.2}"   # пауза между кадрами: служба не должна работать без передышки

pages=$( { echo "$SITE/"; curl -s "$SITE/sitemap-katalog.xml" | grep -oE '<loc>[^<]+</loc>' | sed -E 's#</?loc>##g'; } | sort -u)
[ -n "$pages" ] || { echo "прогрев: нет карты каталога"; exit 0; }

list=$(mktemp)
for p in $pages; do
  # &amp; в HTML → & в запросе браузера: ключ кэша nginx — $request_uri
  curl -s "$p" | grep -oE '/_image\?[^" ,]+' | sed 's/&amp;/\&/g' >> "$list"
done
sort -u "$list" -o "$list"
total=$(wc -l < "$list"); hit=0; miss=0; err=0
while read -r u; do
  st=$(curl -s -o /dev/null -D - "$SITE$u" | tr -d '\r' | awk 'NR==1{c=$2} /^[Xx]-[Cc]ache:/{x=$2} END{print c, x}')
  case "$st" in
    "200 HIT") hit=$((hit+1)) ;;
    200*) miss=$((miss+1)); sleep "$PAUSE" ;;
    *) err=$((err+1)); echo "ошибка ($st): $u" ;;
  esac
done < "$list"
rm -f "$list"
echo "прогрев: кадров $total, уже были $hit, нарезано $miss, ошибок $err"
