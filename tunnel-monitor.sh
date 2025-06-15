#!/bin/bash
BOT_TOKEN="6434111033:AAEzNciNVU0tqkAOK1dEj3ePVO_wL1z3bUw"
CHAT_ID="645927275"
TUNNEL_URL="https://api.kraveapi.xyz/health"
BACKEND_PORT=8000

send_alert() {
  curl -s -X POST "https://api.telegram.org/bot$BOT_TOKEN/sendMessage" \
    -d chat_id="$CHAT_ID" \
    -d parse_mode="Markdown" \
    -d text="$1"
}

check_backend() {
  curl -s --max-time 5 http://localhost:$BACKEND_PORT/health | grep -q '"status":"OK"'
}
check_tunnel() {
  curl -s --max-time 5 "$TUNNEL_URL" | grep -q '"status":"OK"'
}

if ! check_backend; then
  send_alert "🛑 *Backend caído*. Reiniciando..."
  sudo systemctl restart kraveai-python
  sleep 5
  if check_backend; then send_alert "✅ *Backend restaurado📍*"; else send_alert "❌ *Fallo al reiniciar backend*"; fi
else echo "✅ Backend OK"; fi

if ! check_tunnel; then
  send_alert "🛑 *Túnel caído*. Reiniciando..."
  sudo systemctl restart cloudflared
  sleep 5
  if check_tunnel; then send_alert "✅ *Túnel restaurado🌐*"; else send_alert "❌ *Fallo al reiniciar túnel*"; fi
else echo "✅ Túnel OK"; fi
