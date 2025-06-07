# Etapa de construcción
FROM node:20-slim AS builder

WORKDIR /app

# Instalar dependencias necesarias
RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    && curl -sSL https://dl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y \
    google-chrome-stable \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
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
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Crear enlaces simbólicos en etapa de construcción
RUN if [ ! -f /usr/bin/chromium ]; then ln -s /usr/bin/google-chrome-stable /usr/bin/chromium; fi && \
    if [ ! -f /usr/bin/chrome ]; then ln -s /usr/bin/google-chrome-stable /usr/bin/chrome; fi && \
    if [ ! -f /usr/bin/chromium-browser ]; then ln -s /usr/bin/google-chrome-stable /usr/bin/chromium-browser; fi

COPY package.json ./
RUN npm install --omit=dev

# Etapa de producción
FROM node:20-slim

WORKDIR /app

# Copiar dependencias y Chromium
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /usr/bin/google-chrome-stable /usr/bin/
COPY --from=builder /usr/bin/chromium /usr/bin/ || true
COPY --from=builder /usr/bin/chrome /usr/bin/ || true
COPY --from=builder /usr/bin/chromium-browser /usr/bin/ || true
COPY --from=builder /usr/lib/x86_64-linux-gnu/ /usr/lib/x86_64-linux-gnu/
COPY --from=builder /usr/share/fonts/ /usr/share/fonts/
COPY --from=builder /etc/alternatives/ /etc/alternatives/

# Crear enlaces simbólicos solo si no existen
RUN if [ ! -f /usr/bin/chromium ]; then ln -s /usr/bin/google-chrome-stable /usr/bin/chromium; fi && \
    if [ ! -f /usr/bin/chrome ]; then ln -s /usr/bin/google-chrome-stable /usr/bin/chrome; fi && \
    if [ ! -f /usr/bin/chromium-browser ]; then ln -s /usr/bin/google-chrome-stable /usr/bin/chromium-browser; fi

# Configurar entorno para Puppeteer
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    NODE_ENV=production

# Crear usuario no root
RUN groupadd -r appuser && useradd -r -g appuser -G audio,video appuser \
    && mkdir -p /app/logs \
    && chown -R appuser:appuser /app

USER appuser

# Copiar aplicación
COPY --chown=appuser:appuser . .

# Configurar directorio de logs
RUN mkdir -p /app/logs && chown appuser:appuser /app/logs
ENV LOG_DIR=/app/logs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "server.js"]
