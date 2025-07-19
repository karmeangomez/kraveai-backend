#!/bin/bash
cd ~/kraveai-backend
echo "🔄 Actualizando KraveAI desde GitHub..."
git fetch origin
git reset --hard origin/main
echo "✅ Código actualizado desde GitHub."

echo "🚀 Reiniciando backend..."
source venv/bin/activate
pm2 restart backend
pm2 save
echo "✅ Backend reiniciado."

echo "🌐 Verificando /health:"
curl -s https://api.kraveapi.xyz/health | jq .
