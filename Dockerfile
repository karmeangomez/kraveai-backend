# Dockerfile para kraveai-backend
FROM node:18-bullseye-slim

# 1. Actualizar lista de paquetes
RUN apt-get update

# 2. Instalar Chromium con dependencias mínimas
RUN apt-get install -y --no-install-recommends \
    chromium \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libexpat1 \
    libgbm1 \
    libglib2.0-0 \
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
    libxshmfence1 \
    wget \
    xdg-utils

# 3. Limpiar caché para reducir tamaño
RUN apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# 4. Verificar instalación de Chromium
RUN echo "Chromium instalado en:" && \
    which chromium && \
    ls -la /usr/bin/chromium*

# 5. Configurar variables para Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# 6. Crear directorio de trabajo
WORKDIR /app

# 7. Copiar archivos del proyecto
COPY package*.json ./
COPY . .

# 8. Instalar dependencias de Node.js
RUN npm install --production

# 9. Exponer el puerto
EXPOSE 10000

# 10. Comando para iniciar la aplicación
CMD ["node", "server.js"]
