FROM node:18-slim

# Instalar Chromium y librerías necesarias
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libgbm1 \
    libgtk-3-0 \
    libnss3 \
    libxss1 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    --no-install-recommends && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Configurar Puppeteer para usar el Chromium del sistema
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Crear carpeta y copiar código
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Puerto de tu backend (ajústalo si usas otro)
EXPOSE 3000
CMD ["node", "server.js"]
