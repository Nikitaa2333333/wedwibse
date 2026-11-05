#!/usr/bin/env bash
# Чаты, куда добавлен бот MAX, — чтобы взять номер чата модераторов для MAX_CHAT_ID.
#
#   bash scripts/max-chats.sh
#
# Порядок (решение Никиты 05.11.2026): в MAX создать групповой чат модераторов,
# добавить в него бота @id503613656680_bot (участником, лучше администратором),
# запустить этот скрипт, номер нужного чата (chat_id, отрицательное число)
# вписать в /srv/wedsecrets-pb/.env строкой MAX_CHAT_ID=… и перезапустить базу:
#   systemctl restart wedsecrets-pb
# С этого момента всё, что приходит в группу модераторов Telegram, приходит и туда.
# Токен бота читается на сервере и в вывод не попадает.
set -euo pipefail
KEY=${PB_SSH_KEY:-~/.ssh/timeweb_wed}
ssh -i "$KEY" root@193.124.47.78 'set -a; . /srv/wedsecrets-pb/.env; set +a;
  curl -s -H "Authorization: $MAX_BOT_TOKEN" "https://platform-api.max.ru/chats?count=50"' |
  node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
    const j=JSON.parse(s); const chats=(j.chats||[]).filter(c=>c.type!=="dialog");
    if(!chats.length){console.log("бот пока ни в одном групповом чате — добавьте его в чат модераторов");return}
    for(const c of chats) console.log(`${c.chat_id}\t${c.type}\t${c.title||""}\tучастников: ${c.participants_count??"?"}`);
  })'
