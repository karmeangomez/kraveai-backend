#!/bin/bash
cd /home/karmean/kraveai-backend/
source venv/bin/activate

echo "🔄 Reiniciando backend..."
pm2 restart backend

echo "⏳ Esperando backend responda /health..."
until curl -s http://127.0.0.1:8000/health | grep "OK"; do
  sleep 2
done

echo "✅ Backend responde correctamente."

echo "🔄 Reiniciando Cloudflare Tunnel..."
pkill -f cloudflared
sleep 2
cloudflared tunnel run kraveapi &
