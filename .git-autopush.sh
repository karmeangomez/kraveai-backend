#!/bin/bash

cd ~/kraveai-backend
echo "🚀 Autopush activado. Esperando cambios..."

inotifywait -m -r -e close_write . |
while read path action file; do
  if [[ "$file" != *.swp && "$file" != *.log && "$file" != *.json && "$file" != *~ ]]; then
    echo "📦 Cambio detectado en $file, subiendo a GitHub..."
    git add .
    git commit -m "Auto-push desde Raspberry - $file"
    git push origin main
  fi
done
