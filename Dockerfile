# Usa imagen base con Chromium incluido
FROM node:20-slim

# Instala dependencias de Chromium y limpieza
RUN apt-get update && \
    apt-get install -y \
    chromium \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libx11-xcb1 \
    libxcb-dri3-0 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxi6 \
    libxtst6 \
    xdg-utils \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# Configura variables de entorno para Puppeteer
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Configura el usuario de la aplicación (mejores prácticas de seguridad)
RUN useradd -m appuser
USER appuser
WORKDIR /home/appuser/app

# Copia e instala dependencias
COPY package*.json ./
RUN npm install --omit=dev

# Copia el resto de la aplicación
COPY --chown=appuser:appuser . .

# Puerto expuesto
EXPOSE 3000

# Inicia la aplicación
CMD ["node", "server.js"]
