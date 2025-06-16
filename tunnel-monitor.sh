#!/bin/bash

URL="https://api.kraveapi.xyz/health"
TELEGRAM_TOKEN="8066723325:AAH1XgvTqjDZV8wt6TLqP58euK1OwBSd-9A"
CHAT_ID="1740257215"

check_tunnel() {
  curl -s --max-time 5 "$URL" | grep -q '"status":"OK"'
}

if check_tunnel; then
  echo "✅ Túnel activo"
else
  echo "⚠️ Túnel caído. Reiniciando..."
  sudo systemctl restart cloudflared
  sleep 5
  if check_tunnel; then
    echo "✅ Túnel restaurado"
    curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_TOKEN/sendMessage" \
      -d chat_id="$CHAT_ID" \
      -d text="✅ Túnel Cloudflare restaurado en Raspberry Pi" \
      -d parse_mode="Markdown" > /dev/null
  else
    echo "❌ No se pudo restaurar el túnel"
    curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_TOKEN/sendMessage" \
      -d chat_id="$CHAT_ID" \
      -d text="❌ *Túnel sigue caído* en Raspberry Pi" \
      -d parse_mode="Markdown" > /dev/null
  fi
fi
