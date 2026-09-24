#!/usr/bin/env bash
# Ролики (public/**/*.mp4) — на VPS, не в git (24.09.2026).
#   bash scripts/media-push.sh          — залить новые и изменённые (по размеру)
#   bash scripts/media-push.sh --list   — только показать, что уедет
#
# Файлы лежат на сервере в /var/www/wedsecrets-media тем же путём, что
# в public/ (reels/x.mp4, venues/<slug>/reel-01.mp4). nginx отдаёт любой .mp4
# оттуда (location ~* \.(mp4|webm)$ { root /var/www/wedsecrets-media; }),
# поэтому адреса в data/reels.ts не меняются. Каталог вне /var/www/wedsecrets:
# деплой делает rsync --delete и стёр бы ролики, лежи они внутри сайта.
#
# Запускать из Git Bash: Windows-ssh не принимает ключ timeweb_wed из-за
# прав на файл. rsync на Windows нет — отправляем tar'ом только разницу.
set -euo pipefail
cd "$(dirname "$0")/../public"

KEY=~/.ssh/timeweb_wed
HOST=root@193.124.47.78
DIR=/var/www/wedsecrets-media
SSH=(ssh -i "$KEY" -o BatchMode=yes "$HOST")

remote=$("${SSH[@]}" "mkdir -p $DIR && cd $DIR && find . -name '*.mp4' -printf './%P %s\n'" | sort)
todo=()
while IFS= read -r f; do
  size=$(stat -c %s "$f")
  grep -qxF "$f $size" <<<"$remote" || todo+=("$f")
done < <(find . -name '*.mp4' | sort)

echo "к заливке: ${#todo[@]}"
printf '  %s\n' "${todo[@]}"
[[ "${1:-}" == "--list" || ${#todo[@]} -eq 0 ]] && exit 0

# По одному файлу и с повтором: одним tar-потоком на 110 МБ соединение
# до сервера рвалось (Connection reset), как и пуш в GitHub. Пишем во
# временный .part и переименовываем — оборванный файл не встанет на место.
for f in "${todo[@]}"; do
  p="${f#./}"
  for try in 1 2 3 4; do
    if "${SSH[@]}" "mkdir -p '$DIR/$(dirname "$p")' && cat > '$DIR/$p.part' && mv '$DIR/$p.part' '$DIR/$p'" < "$f"; then
      echo "  ✓ $p"; break
    fi
    echo "  повтор $try: $p"
    [[ $try == 4 ]] && { echo "  × не залит: $p"; exit 1; }
  done
done
"${SSH[@]}" "chown -R deploy:www-data $DIR"
echo "готово: $("${SSH[@]}" "find $DIR -name '*.mp4' | wc -l") роликов на сервере"
