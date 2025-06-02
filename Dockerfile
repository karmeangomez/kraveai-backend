FROM node:18-slim

# Instalar librerías necesarias para Puppeteer y Chromium
RUN apt-get update && apt-get install -y \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libx11-xcb1 libgtk-3-0 libgbm-dev \
    ca-certificates fonts-liberation libasound2 libxrandr2 libxdamage1 libxcomposite1 \
    libxext6 libxfixes3 libxss1 libxrender1 libx11-6 libxcb1 libxi6 libxtst6 \
    --no-install-recommends && rm -rf /var/lib/apt/lists/*

# No descargar Chromium (ya lo provee @sparticuz)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000
CMD ["node", "server.js"]
