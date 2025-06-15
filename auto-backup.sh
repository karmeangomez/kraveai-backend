#!/bin/bash

# Ruta base
cd /home/karmean/kraveai-backend || exit 1

# Fecha para logs
DATE=$(date '+%Y-%m-%d %H:%M')

# Realiza backup
git add .
git commit -m "📦 Auto backup $DATE" > /dev/null 2>&1

# Intenta pull + push
OUTPUT=$(git pull --rebase && git push origin main 2>&1)
STATUS=$?

# Si falla, envía a Telegram
if [ $STATUS -ne 0 ]; then
  TELEGRAM_TOKEN="8066723325:AAH1XgvTqjDZV8wt6TLqP58euK1OwBSd-9A"
  CHAT_ID="1740257215"
  MSG="⚠️ *Error al hacer backup en GitHub*
\`\`\`
$OUTPUT
\`\`\`"

  curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_TOKEN/sendMessage" \
       -d chat_id="$CHAT_ID" \
       -d text="$MSG" \
       -d parse_mode="Markdown"
fi
