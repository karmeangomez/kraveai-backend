# Base Node.js (LTS) en versión slim para reducir tamaño
FROM node:18-slim

# Instalar dependencias del sistema necesarias para Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libnspr4 \
    libatk1.0-0 libatk-bridge2.0-0 \
    libcairo2 libpango-1.0-0 libpangocairo-1.0-0 \
    libgtk-3-0 \
    libx11-xcb1 libxcomposite1 libxcursor1 libxdamage1 \
    libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 \
    libglib2.0-0 libdrm2 libgbm1 libasound2 \
    ca-certificates fonts-liberation fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

# Directorio de trabajo de la app
WORKDIR /app

# Evitar descarga de Chromium (usaremos @sparticuz/chromium)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Instalar dependencias de Node.js
COPY package*.json ./
RUN npm install --production

# Copiar el código de la aplicación
COPY . .

# Exponer el puerto de la aplicación (Render usará PORT env)
EXPOSE 3000

# Comando de arranque del contenedor
CMD ["npm", "start"]
