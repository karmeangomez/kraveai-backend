# Dockerfile para kraveai-backend
FROM node:18-bullseye-slim

# Instalar dependencias para Chromium y crear enlace simbólico
RUN apt-get update && \
    apt-get install -y \
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    ca-certificates \
    fonts-liberation \
    libappindicator1 \
    libnss3 \
    lsb-release \
    xdg-utils \
    wget && \
    rm -rf /var/lib/apt/lists/* && \
    # Crear enlace simbólico para Chromium
    ln -s /usr/bin/chromium /usr/bin/chromium-browser

# Configurar Chromium para Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV CHROMIUM_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Crear directorio de trabajo
WORKDIR /app

# Copiar archivos del proyecto
COPY package*.json ./
COPY . .

# Instalar dependencias de Node.js
RUN npm install --production

# Exponer el puerto 10000
EXPOSE 10000

# Comando para iniciar la aplicación
CMD ["node", "server.js"]
