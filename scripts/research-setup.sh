#!/usr/bin/env bash
# Разовая настройка сервера под выгрузку материалов подрядчиков.
#
#   bash scripts/research-setup.sh          — поставить/обновить
#   bash scripts/research-setup.sh --check  — только проверить, что стоит
#
# Зачем на сервере: с ноутбука через VPN Яндекс.Диск отдаёт 4 Мбит/с и рвёт
# соединения, с этого VPS (Россия) — сотни мегабит. Замер на одном диске:
# 392 МБ за 11 секунд против ~13 минут. Подробности — CONTENT-PIPELINE.md.
#
# Идемпотентно: гоняй сколько угодно, Node ставится один раз, загрузчик
# перезаливается всегда (он меняется чаще).
#
# Запускать из Git Bash: Windows-ssh не принимает ключ timeweb_wed из-за
# прав на файл.
set -euo pipefail
cd "$(dirname "$0")/.."

KEY=~/.ssh/timeweb_wed
HOST=root@193.124.47.78
DIR=/srv/wed-research
# ConnectionAttempts: канал до сервера периодически рвётся на рукопожатии
# (см. скилл vpn-routing). Без повторов скрипт падает с первой попытки,
# хотя вторая-третья обычно проходят.
SSH=(ssh -i "$KEY" -o BatchMode=yes -o ConnectTimeout=20 -o ConnectionAttempts=4 -o ServerAliveInterval=15 "$HOST")

# Повтор всего вызова: канал рвётся не на установке TCP (это лечит
# ConnectionAttempts), а на SSH-рукопожатии — "kex_exchange_identification:
# Connection closed". Такое ConnectionAttempts не перезапускает, поэтому
# оборачиваем сами. Вторая-третья попытка обычно проходит.
sshx() {
  local try
  for try in 1 2 3 4 5; do
    if "${SSH[@]}" "$@"; then return 0; fi
    [[ $try -lt 5 ]] && { echo "  обрыв, повтор $try..." >&2; sleep $((try * 2)); }
  done
  echo "Не достучался до сервера за 5 попыток. Проверь маршруты: скилл vpn-routing." >&2
  return 1
}

if [[ "${1:-}" == "--check" ]]; then
  sshx "
    echo \"node:      \$(node -v 2>/dev/null || echo НЕТ)\"
    echo \"загрузчик: \$([ -f $DIR/bin/fetch-yadisk.mjs ] && echo есть || echo НЕТ)\"
    echo \"пережатие: \$([ -d $DIR/node_modules/sharp ] && echo sharp есть || echo НЕТ)\"
    echo \"ffmpeg:    \$($DIR/bin/ffmpeg -version 2>/dev/null | head -1 | cut -d' ' -f3 || echo НЕТ)\"
    echo \"каталоги:  \$([ -d $DIR/out ] && echo есть || echo НЕТ)\"
    echo \"диск:      \$(df -h / | awk 'NR==2{print \$4\" свободно\"}')\"
    echo \"выгружено: \$(du -sh $DIR/out 2>/dev/null | cut -f1 || echo 0)\"
  "
  exit 0
fi

echo "1/5 Node..."
# Node 22 есть в репозиториях Ubuntu 26.04 — та же мажорная версия, что в
# .github/workflows/deploy.yml, отдельный NodeSource не нужен.
sshx "
  if ! command -v node >/dev/null; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq && apt-get install -y -qq nodejs npm
  fi
  echo \"    \$(node -v)\"
"

echo "2/5 каталоги..."
# Вне /var/www/wedsecrets сознательно: деплой делает rsync --delete и стёр бы
# всё, лежи оно внутри сайта. Та же причина, что у wedsecrets-media.
sshx "mkdir -p $DIR/bin $DIR/out && chown -R deploy:deploy $DIR && echo '    $DIR'"

echo "3/5 загрузчик и пережатие..."
scp -i "$KEY" -o BatchMode=yes -o ConnectionAttempts=4 -q scripts/fetch-yadisk.mjs scripts/prep-photos-server.mjs "$HOST:$DIR/bin/"
sshx "node --check $DIR/bin/fetch-yadisk.mjs && node --check $DIR/bin/prep-photos-server.mjs && chown deploy:deploy $DIR/bin/*.mjs && echo '    залиты, синтаксис в порядке'"

echo "4/5 sharp..."
# Пережатие кадров на сервере (prep-photos-server.mjs): на ноутбук идут
# готовые webp, а не оригиналы — в 5–10 раз легче через VPN. sharp ставится
# в $DIR, а не глобально: у него готовая сборка под linux-x64, системный
# ImageMagick не нужен. Скрипт лежит в $DIR/bin и находит модуль уровнем выше.
sshx "
  cd $DIR
  [ -f package.json ] || echo '{\"private\":true,\"type\":\"module\"}' > package.json
  [ -d node_modules/sharp ] || npm install --silent --no-audit --no-fund sharp
  chown -R deploy:deploy package.json node_modules
  node -e \"import('sharp').then(s=>console.log('    sharp', s.default.versions.sharp))\"
"

echo "5/5 ffmpeg..."
# Статическая сборка (johnvansickle) одним файлом в $DIR/bin, без пакетов
# в систему: ролики режутся прямо на сервере, на ноутбук — готовые 2–8 МБ.
sshx "
  cd $DIR/bin
  if [ ! -x ffmpeg ]; then
    curl -sL -o /tmp/ff.tar.xz https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz
    tar -xJf /tmp/ff.tar.xz -C /tmp && cp /tmp/ffmpeg-*-static/ffmpeg /tmp/ffmpeg-*-static/ffprobe .
    rm -rf /tmp/ff.tar.xz /tmp/ffmpeg-*-static
  fi
  chown deploy:deploy ffmpeg ffprobe
  echo \"    \$(./ffmpeg -version | head -1 | cut -d' ' -f1-3)\"
"

echo
echo "Готово. Дальше — bash scripts/research.sh"
