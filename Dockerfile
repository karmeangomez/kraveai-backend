# Dockerfile para kraveai-backend
FROM node:18-bullseye-slim

# Instalar dependencias para Chromium y crear enlace simbólico
RUN apt-get update && \
    apt-get install -y \
    chromium \
    chromium-common \
    chromium-driver \
    # ... (mantén todas las dependencias anteriores) ... \
    && rm -rf /var/lib/apt/lists/* \
    # Crear enlace simbólico para Chromium
    && ln -s /usr/bin/chromium /usr/bin/chromium-browser

# Configurar Chromium para Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV CHROMIUM_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# ... (resto del Dockerfile igual) ...
