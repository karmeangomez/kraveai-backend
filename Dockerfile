# Etapa 1: Build con dependencias y Google Chrome
FROM node:20-slim AS builder

WORKDIR /app

# Instala dependencias mínimas para Chrome y compilación
RUN apt-get update && apt-get install -y \
    wget gnupg curl ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 \
    libatk1.0-0 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libglib2.0-0 \
    libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 libx11-6 \
    libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 \
    libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 xdg-utils \
    build-essential \
    --no-install-recommends && rm -rf /var/lib/apt/lists/*

# Instala Google Chrome
RUN curl -fsSL https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /etc/apt/trusted.gpg.d/google.gpg && \
    echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google.list && \
    apt-get update && apt-get install -y google-chrome-stable && \
    ln -s /usr/bin/google-chrome-stable /usr/bin/chromium-browser && \
    rm -rf /var/lib/apt/lists/*

# Variables necesarias para Puppeteer
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Copia package.json primero
COPY package.json ./

# Copia package-lock.json condicionalmente
COPY package-lock.json* ./

# Instala dependencias condicionalmente
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

# Etapa 2: Producción final
FROM node:20-slim

WORKDIR /app

# Copia Chrome y dependencias esenciales
COPY --from=builder /usr/bin/google-chrome-stable /usr/bin/
COPY --from=builder /usr/lib/lib* /usr/lib/
COPY --from=builder /usr/share/fonts /usr/share/fonts
COPY --from=builder /etc/apt/trusted.gpg.d/google.gpg /etc/apt/trusted.gpg.d/
COPY --from=builder /etc/apt/sources.list.d/google.list /etc/apt/sources.list.d/
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Configura entorno
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV NODE_ENV=production
ENV LOG_DIR=/app/logs

# Asegura permisos para logs y sesiones
RUN mkdir -p /app/logs /app/sessions && chmod 777 /app/logs /app/sessions

EXPOSE 3000

# Healthcheck manual en /health
HEALTHCHECK NONE

CMD ["node", "server.js"]
