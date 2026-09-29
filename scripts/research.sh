#!/usr/bin/env bash
# Выгрузка материалов подрядчика — качает сервер, а не ноутбук.
#
#   bash scripts/research.sh list    <url>                 что на диске и сколько весит
#   bash scripts/research.sh preview <слаг> <url>          превью на сервер + к себе на отбор
#   bash scripts/research.sh pick    <слаг> "004 007 012"  оригиналы отобранных
#   bash scripts/research.sh all     <слаг> <url> [--only=photo|video]
#   bash scripts/research.sh pull    <слаг> [prev|raw]     забрать папку к себе
#   bash scripts/research.sh ls      [слаг]                что уже выгружено
#
# Порядок работы: list → preview → смотришь контактный лист глазами → pick.
# Отбор кадров остаётся за человеком, поэтому превью и оригиналы разведены:
# сначала дёшево тянем миниатюры, потом дорого — только выбранное.
#
# Сервер настраивается один раз: bash scripts/research-setup.sh
# Запускать из Git Bash (ключ timeweb_wed не принимается Windows-ssh).
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
RUN="cd $DIR && node bin/fetch-yadisk.mjs"

usage() { sed -n '2,16p' "$0" | sed 's/^# \?//'; exit 1; }
cmd="${1:-}"; shift || true
[[ -z "$cmd" ]] && usage

# Тянем папку с сервера tar-потоком: rsync на Windows нет, а scp на сотнях
# мелких файлов работает заметно дольше.
pull() {
  local slug="$1" what="${2:-prev}"
  local dest="research/specialists/$slug"
  mkdir -p "$dest"
  echo "забираю $what/ подрядчика $slug..."
  sshx "cd $DIR/out/$slug && tar czf - $what" | tar xzf - -C "$dest"
  echo "  -> $dest/$what ($(find "$dest/$what" -type f | wc -l | tr -d ' ') файлов)"
}

case "$cmd" in
  list)
    [[ $# -lt 1 ]] && usage
    sshx "$RUN '$1' out/_tmp --mode=list"
    ;;

  preview)
    [[ $# -lt 2 ]] && usage
    slug="$1"; url="$2"
    # Ссылку кладём рядом с превью: pick вызывается позже, отдельной командой,
    # и заставлять вспоминать URL второй раз незачем.
    sshx "$RUN '$url' out/$slug --mode=preview --jobs=6 && printf '%s' '$url' > $DIR/out/$slug/.url"
    pull "$slug" prev
    echo
    echo "Открой research/specialists/$slug/prev/ и выбери кадры."
    echo "Дальше: bash scripts/research.sh pick $slug \"004 007 012\""
    ;;

  pick)
    [[ $# -lt 2 ]] && usage
    slug="$1"; picks="$2"
    # URL на сервере не нужен заново: index.tsv рядом с превью хранит пути,
    # но сам ключ диска нужен для скачивания — берём его из сохранённого файла.
    url=$(sshx "cat $DIR/out/$slug/.url 2>/dev/null" || true)
    [[ -z "$url" ]] && { echo "Не нашёл ссылку на диск для '$slug'. Прогони сначала preview."; exit 1; }
    sshx "$RUN '$url' out/$slug --pick='$picks' --jobs=6"
    pull "$slug" raw
    ;;

  all)
    [[ $# -lt 2 ]] && usage
    slug="$1"; url="$2"; shift 2
    sshx "$RUN '$url' out/$slug ${*} --jobs=6"
    echo
    echo "Лежит на сервере: $DIR/out/$slug"
    echo "Забрать к себе:   bash scripts/research.sh pull $slug"
    ;;

  pull)
    [[ $# -lt 1 ]] && usage
    pull "$1" "${2:-raw}"
    ;;

  ls)
    if [[ $# -ge 1 ]]; then
      sshx "du -sh $DIR/out/$1/* 2>/dev/null | sort -rh"
    else
      sshx "du -sh $DIR/out/* 2>/dev/null | sort -rh; echo; df -h / | awk 'NR==2{print \"диск: \"\$4\" свободно\"}'"
    fi
    ;;

  *) usage ;;
esac
