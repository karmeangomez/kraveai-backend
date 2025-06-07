# Etapa de construcción
FROM node:20-slim AS builder

WORKDIR /app

# Instalar Chrome y dependencias
RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    && curl -sSL https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/googlechrome-linux-keyring.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/googlechrome-linux-keyring.gpg] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y \
    google-chrome-stable \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Crear enlaces simbólicos
RUN ln -sf /usr/bin/google-chrome-stable /usr/bin/chromium && \
    ln -sf /usr/bin/google-chrome-stable /usr/bin/chrome && \
    ln -sf /usr/bin/google-chrome-stable /usr/bin/chromium-browser

COPY package.json ./
RUN npm install --omit=dev

# Etapa de producción
FROM node:20-slim

WORKDIR /app

# Copiar dependencias y Chrome
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /usr/bin/google-chrome-stable /usr/bin/
COPY --from=builder /usr/lib/x86_64-linux-gnu/ /usr/lib/x86_64-linux-gnu/
COPY --from=builder /usr/share/fonts/ /usr/share/fonts/
COPY --from=builder /etc/alternatives/ /etc/alternatives/

# Recrear enlaces simbólicos
RUN ln -sf /usr/bin/google-chrome-stable /usr/bin/chromium && \
    ln -sf /usr/bin/google-chrome-stable /usr/bin/chrome && \
    ln -sf /usr/bin/google-chrome-stable /usr/bin/chromium-browser

# Variables de entorno
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    NODE_ENV=production

# Configurar usuario
RUN groupadd -r appuser && useradd -r -g appuser -G audio,video appuser \
    && chown -R appuser:appuser /app \
    && mkdir -p /app/logs \
    && chown appuser:appuser /app/logs

USER appuser

# Copiar aplicación
COPY --chown=appuser:appuser . .

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD curl -f http://localhost:3000/health || exit 1
CMD ["node", "server.js"]
