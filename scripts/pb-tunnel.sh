#!/usr/bin/env bash
# Туннель к PocketBase на VPS (06.10.2026: база переехала с ноутбука на сервер).
#
#   bash scripts/pb-tunnel.sh          — открыть: сервер 127.0.0.1:8090 → здесь 127.0.0.1:8090
#   bash scripts/pb-tunnel.sh --stop   — закрыть
#
# База слушает только 127.0.0.1 сервера — снаружи её нет вовсе. Ходят к ней
# через SSH: с ноутбука — root с ключом timeweb_wed, из GitHub Actions —
# deploy с ключом деплоя (PB_SSH_KEY / PB_SSH_HOST). После туннеля
# pb-seed / pb-pull работают как раньше с PB_URL=http://127.0.0.1:8090.
#
# Локальный pb/pocketbase.exe больше не источник правды — не запускать его
# на том же порту, пока открыт туннель (порт будет занят, ошибка сразу).
set -euo pipefail
KEY=${PB_SSH_KEY:-~/.ssh/timeweb_wed}
HOST=${PB_SSH_HOST:-root@193.124.47.78}
PORT=${PB_LOCAL_PORT:-8090}

if [[ "${1:-}" == "--stop" ]]; then
  if command -v pkill >/dev/null; then
    pkill -f "ssh .*-L ${PORT}:127.0.0.1:8090" && echo "туннель закрыт" || echo "туннеля не было"
    exit 0
  fi
  # Git Bash на Windows: pkill нет, командной строки процесса ps не показывает —
  # ищем ssh с этим пробросом через PowerShell и гасим только его PID
  n=$(powershell.exe -NoProfile -Command "\$p = @(Get-CimInstance Win32_Process -Filter \"Name='ssh.exe'\" | Where-Object { \$_.CommandLine -match '-L ${PORT}:127.0.0.1:8090' }); \$p | ForEach-Object { Stop-Process -Id \$_.ProcessId }; \$p.Count" | tr -d '\r')
  [[ "$n" != "0" ]] && echo "туннель закрыт" || echo "туннеля не было"
  exit 0
fi

if curl -s -m 3 "http://127.0.0.1:${PORT}/api/health" >/dev/null; then
  echo "на :${PORT} уже кто-то отвечает (туннель открыт или запущен локальный PocketBase)"
  exit 0
fi

ssh -i "$KEY" -o BatchMode=yes -o ExitOnForwardFailure=yes -o ServerAliveInterval=15 \
  -f -N -L "${PORT}:127.0.0.1:8090" "$HOST"

for _ in 1 2 3 4 5 6 7 8 9 10; do
  curl -s -m 3 "http://127.0.0.1:${PORT}/api/health" >/dev/null && { echo "туннель открыт: http://127.0.0.1:${PORT}"; exit 0; }
  sleep 1
done
echo "туннель открыт, но база не отвечает — проверь на сервере: systemctl status wedsecrets-pb" >&2
exit 1
