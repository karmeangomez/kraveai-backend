#!/bin/bash

# Configurar entorno gráfico
export DISPLAY=:0
xset s off
xset -dpms

# Iniciar gestor de ventanas simple
openbox &

# Configuración de Puppeteer
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
export HEADLESS=false

# Iniciar la aplicación
cd /home/karmean/kraveai-backend
node src/run.js

# Mantener el script en ejecución
wait
