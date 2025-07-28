#!/bin/bash

echo "========================"
echo "🕒 $(date): Ejecutando actualización automática"
echo "========================"

cd /home/karmean/kraveai-backend || exit 1
source venv/bin/activate

# Arreglar Git si hay corrupción
find .git/objects -type f -empty -delete

# Actualizar desde GitHub
git pull origin main && echo "✅ Código actualizado" || echo "⚠️ Error al actualizar código"

# Cargar PM2 desde NVM
export NVM_DIR="$HOME/.nvm"
source "$NVM_DIR/nvm.sh"
nvm use default
echo "🚀 Reiniciando backend con PM2"
pm2 restart backend

# Verificar backend
echo "🌐 Verificando /health..."
curl -s http://localhost:8000/health

# Restaurar sesiones
echo "👤 Restaurando sesión kraveaibot..."
python3 -m src.iniciar_sesion_kraveaibot

echo "👥 Restaurando cuentas manuales..."
python3 -m src.restaurar_cuentas_guardadas

echo "✅ Rutina completa - $(date)"
