FROM node:20-slim

# Instalar librerías necesarias para Chromium
RUN apt-get update && apt-get install -y \
  wget \
  ca-certificates \
  fonts-liberation \
  libappindicator3-1 \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libcups2 \
  libdbus-1-3 \
  libgdk-pixbuf2.0-0 \
  libnspr4 \
  libnss3 \
  libx11-xcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  libgbm1 \
  xdg-utils \
  --no-install-recommends && \
  rm -rf /var/lib/apt/lists/*

# 🔧 Evita doble descarga de Chromium durante npm install
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

WORKDIR /app

# Copiar archivos del proyecto
COPY . .

# Instalar dependencias sin romperse por peer dependencies
RUN npm install --legacy-peer-deps

# Instalar Chromium después
RUN npx puppeteer install

EXPOSE 3000

CMD ["node", "server.js"]
