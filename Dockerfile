# Imagen base ligera
FROM node:20-slim

# 1. Instala Chromium + herramientas de compilación necesarias para puppeteer y proxy-chain
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libgbm1 \
    libglib2.0-0 \
    libnss3 \
    libx11-6 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libxss1 \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# 2. Variables para Puppeteer (usamos Chromium ya instalado)
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    NODE_ENV=production

# 3. Establece el directorio de trabajo
WORKDIR /app

# 4. Copia solo package.json y lock para instalar dependencias
COPY package.json package-lock.json* ./

# 5. Instala solo dependencias de producción
RUN npm install --omit=dev && npm cache clean --force

# 6. Copia el resto del código
COPY . .

# 7. Expone el puerto de la app
EXPOSE 3000

# 8. Comando de arranque
CMD ["npm", "start"]