#!/usr/bin/env bash
# Номер чата модераторов в MAX для MAX_CHAT_ID.
#
#   bash scripts/max-chats.sh
#
# Списка чатов у Bot API MAX больше нет (GET /chats отключён в 2026), поэтому
# номер берём из журнала базы: вебхук бота пишет «max: бот в чате» с chat_id,
# когда бота добавляют в чат (bot_added) или в чате появляется сообщение.
#
# Порядок (решение Никиты 05.11.2026):
#  1. business.max.ru/self → Чат-боты → бот → ⋮ → Настройки → Приватность →
#     «Разрешить добавление в групповые чаты» (по умолчанию запрещено — бот в
#     списке участников серый и не выбирается).
#  2. Создать в MAX групповой чат модераторов, добавить бота, назначить
#     администратором (права read_all_messages, write).
#  3. Написать в чат любое сообщение — вебхук запишет номер.
#  4. Этот скрипт → MAX_CHAT_ID=<номер> в /srv/wedsecrets-pb/.env →
#     systemctl restart wedsecrets-pb.
# Подписка вебхука должна включать bot_added и message_created (см. docs/DEPLOY.md).
set -euo pipefail
KEY=${PB_SSH_KEY:-~/.ssh/timeweb_wed}
ssh -i "$KEY" root@193.124.47.78 "sqlite3 -readonly /srv/wedsecrets-pb/pb_data/auxiliary.db \
  \"select max(substr(created,1,19)), json_extract(data,'\\$.chat_id'), json_extract(data,'\\$.is_channel'), count(*)
    from _logs where message = 'max: бот в чате' group by 2 order by 1 desc\"" |
  awk -F'|' 'BEGIN{n=0} {n++; printf "chat_id %s\t%s\tпоследнее событие %s\tсобытий %s\n", $2, ($3=="1"?"канал":"чат"), $1, $4} END{if(!n) print "событий нет — бот не добавлен в чат или подписка вебхука без bot_added/message_created"}'
