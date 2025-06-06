FROM node:20-slim

# Instalar dependencias mínimas para Chromium
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libgbm1 \
    libnss3 \
    --no-install-recommends && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Configurar variables de entorno para Puppeteer
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

WORKDIR /app

# Copiar archivos de dependencias primero para aprovechar el caché
COPY package.json package-lock.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copiar el resto del proyecto
COPY . .

EXPOSE 3000

CMD ["npm", "start"]
