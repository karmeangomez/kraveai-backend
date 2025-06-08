# Imagen base ligera
FROM node:20-slim

# Crear directorio de trabajo
WORKDIR /app

# Instalar solo lo necesario
RUN apt-get update && apt-get install -y \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libnss3 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libxshmfence1 \
    libglu1-mesa \
    libgtk-3-0 \
    libxss1 \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# Copiar dependencias y código
COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Variables necesarias para Puppeteer + Chromium
ENV NODE_ENV=production
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Expone el puerto del server.js
EXPOSE 3000

# Inicia el servidor
CMD ["node", "server.js"]
