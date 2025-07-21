#!/bin/bash
echo "🛠️  Iniciando KraveAI Backend + Cloudflare Tunnel..."

# Activar entorno virtual para ti en consola si quieres usarlo después
source ~/kraveai-backend/venv/bin/activate

# Reiniciar backend FastAPI con PM2
echo "🔄 Reiniciando backend con PM2..."
pm2 restart backend || pm2 start ~/kraveai-backend/start.sh --name backend && pm2 save

# Verificar backend activo
sleep 2
echo "✅ Backend está corriendo:"
pm2 ls | grep backend

# Iniciar Cloudflare Tunnel manualmente (corre en segundo plano)
echo "🌐 Iniciando túnel Cloudflare..."
nohup cloudflared tunnel run kraveai > ~/kraveai-backend/logs/cloudflared.log 2>&1 &

sleep 2
echo "✅ Cloudflare Tunnel está corriendo (en background)"

# Verificar que /health está OK
echo "🩺 Verificando /health:"
curl -s https://api.kraveapi.xyz/health | jq || curl -s https://api.kraveapi.xyz/health

echo "🚀 KraveAI está listo. 🎉"

