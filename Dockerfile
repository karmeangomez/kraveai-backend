# Dockerfile – Configuración de la imagen para Puppeteer
FROM node:18-bullseye

# Instalar Chromium y dependencias necesarias
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    libasound2 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
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
  && rm -rf /var/lib/apt/lists/*

# Evitar que Puppeteer (no-core) intente descargar Chromium en la instalación
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Configurar el directorio de la aplicación
WORKDIR /app

# Copiar archivos de dependencia e instalar (solo módulos de producción para reducir peso)
COPY package.json package-lock.json* ./ 
RUN npm install --production

# Copiar el resto del código de la aplicación
COPY . .

# Puerto en el que la aplicación escuchará (usar $PORT en Render)
ENV PORT 3000
EXPOSE 3000

# Comando de arranque por defecto
CMD ["node", "server.js"]
