#!/bin/bash
echo "🔄 Actualizando KraveAI desde GitHub..."

cd /home/karmean/kraveai-backend

git fetch --all
git reset --hard origin/main
git pull origin main

pm2 restart backend --update-env
pm2 save

echo "🚀 Backend reiniciado con éxito. Revisa /health para confirmar login."
