#!/bin/bash

echo "🔁 Actualizando KraveAI desde GitHub..."

cd ~/kraveai-backend || exit 1

echo "📦 Haciendo git fetch + reset..."
git fetch --all
git reset --hard origin/main

echo "🚀 Reiniciando servicios..."
sudo systemctl restart kraveai-python.service
sudo systemctl restart crear-cuentas.service

echo "✅ Actualización completada. Estado:"
curl -s http://localhost:8000/health || echo "⚠️ El backend no respondió."

echo "📂 Últimas cuentas:"
tail -n 5 cuentas_creadas.json 2>/dev/null || echo "⚠️ Aún no hay cuentas registradas"
