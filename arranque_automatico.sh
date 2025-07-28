#!/bin/bash

echo "========================"
echo "🕒 $(date): AUTO-ARRANQUE KRAVEAI"
echo "========================"

cd /home/karmean/kraveai-backend || exit 1
source venv/bin/activate

# Eliminar archivos corruptos de git
find .git/objects -type f -empty -delete

# Intentar actualizar desde GitHub
git pull origin main && echo "✅ Código actualizado" || echo "⚠️ Error al actualizar código"

# Reiniciar backend con PM2 (sin usar nvm)
echo "🚀 Reiniciando backend con PM2..."
pm2 restart backend

# Verificar salud
echo "🌐 Verificando /health..."
curl -s http://localhost:8000/health

# Restaurar sesión de kraveaibot
echo "👤 Restaurando sesión kraveaibot..."
python3 -m src.iniciar_sesion_kraveaibot

# Restaurar cuentas manuales
echo "👥 Restaurando cuentas manuales..."
python3 -m src.restaurar_cuentas_guardadas

echo "✅ Rutina completa - $(date)"
