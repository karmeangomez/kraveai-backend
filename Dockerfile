# Etapa 1: build con puppeteer y chromium
FROM node:20-slim AS builder

# Instalar dependencias necesarias para Puppeteer + Chromium
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
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
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Etapa 2: imagen final mínima con todo listo
FROM node:20-slim

# Copiar binarios necesarios del builder
RUN apt-get update && apt-get install -y \
    chromium \
    libnss3 \
    libxss1 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    fonts-liberation \
    xdg-utils \
    libgbm1 \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app .

EXPOSE 3000
CMD ["node", "server.js"]
