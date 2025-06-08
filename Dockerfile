# Etapa 1: Build con dependencias y Google Chrome
FROM node:20-slim AS builder

WORKDIR /app

# Instala dependencias completas para Chrome
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
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
    lsb-release \
    wget \
    xdg-utils \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# Instala Google Chrome
RUN wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/googlechrome-linux-keyring.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/googlechrome-linux-keyring.gpg] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable --no-install-recommends \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/bin/google-chrome-stable /usr/bin/chromium-browser

# Copia package.json y package-lock.json
COPY package.json ./
COPY package-lock.json* ./

# Instala dependencias
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

# Etapa 2: Producción
FROM node:20-slim

WORKDIR /app

# Instala dependencias mínimas para Chrome en producción
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
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
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Copia Chrome y configuraciones
COPY --from=builder /usr/bin/google-chrome-stable /usr/bin/
COPY --from=builder /usr/share/keyrings/googlechrome-linux-keyring.gpg /usr/share/keyrings/
COPY --from=builder /etc/apt/sources.list.d/google-chrome.list /etc/apt/sources.list.d/
COPY --from=builder /usr/lib/lib* /usr/lib/
COPY --from=builder /usr/share/fonts /usr/share/fonts
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Configura usuario no privilegiado
RUN groupadd -r pptruser && useradd -r -g pptruser -G audio,video pptruser \
    && mkdir -p /home/pptruser/Downloads /app/sessions /app/logs \
    && chown -R pptruser:pptruser /home/pptruser /app/sessions /app/logs /app/node_modules /app/package.json /app/package-lock.json* \
    && chmod -R 777 /app/sessions /app/logs

# Configura entorno
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV NODE_ENV=production
ENV LOG_DIR=/app/logs

# Usa usuario no privilegiado
USER pptruser

EXPOSE 3000

HEALTHCHECK NONE

CMD ["node", "server.js"]
