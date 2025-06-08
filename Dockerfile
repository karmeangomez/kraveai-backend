# Etapa 1: Build con dependencias y Google Chrome
FROM node:20-slim AS builder

WORKDIR /app

# Instala Chrome y dependencias mínimas
RUN apt-get update && apt-get install -y \
    wget gnupg curl ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 \
    libatk1.0-0 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libglib2.0-0 \
    libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 libx11-6 \
    libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 \
    libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 xdg-utils \
    --no-install-recommends && rm -rf /var/lib/apt/lists/*

# Instala Google Chrome
RUN curl -fsSL https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /etc/apt/trusted.gpg.d/google.gpg && \
    echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google.list && \
    apt-get update && apt-get install -y google-chrome-stable && \
    ln -s /usr/bin/google-chrome-stable /usr/bin/chromium-browser

# Variables necesarias para Puppeteer
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

COPY package*.json ./
RUN npm install --omit=dev

# Etapa 2: Producción final
FROM node:20-slim

WORKDIR /app

COPY --from=builder /usr/bin/google-chrome-stable /usr/bin/
COPY --from=builder /usr/lib/ /usr/lib/
COPY --from=builder /usr/share/fonts /usr/share/fonts
COPY --from=builder /app/node_modules ./node_modules
COPY . .

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV NODE_ENV=production

# Logs y errores más claros
ENV LOG_DIR=/app/logs

EXPOSE 3000

# Elimina healthcheck de Railway (usamos uno manual en `/health`)
HEALTHCHECK NONE

CMD ["node", "server.js"]
