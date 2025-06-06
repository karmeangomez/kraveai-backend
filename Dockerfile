# Usa imagen oficial de Node.js
FROM node:20-slim

# Instala Chromium y dependencias mínimas
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libexpat1 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libx11-6 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Configura Puppeteer para usar Chromium del sistema
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Configura directorio de trabajo
WORKDIR /app

# Copia archivos de dependencias
COPY package.json ./

# Instala dependencias de Node.js
RUN npm install --omit=dev

# Copia la aplicación
COPY . .

# Expone el puerto
EXPOSE 3000

# Inicia la aplicación
CMD ["node", "server.js"]
