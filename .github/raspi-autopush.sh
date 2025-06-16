#!/bin/bash

cd ~/kraveai-backend

CHANGES=$(git status --porcelain)

if [ -n "$CHANGES" ]; then
  echo "📁 Cambios detectados, haciendo push..."
  git add .
  git commit -m "🔁 Auto push desde Raspberry Pi"
  git push origin main
  echo "✅ Push completado"
else
  echo "✅ Sin cambios locales"
fi
