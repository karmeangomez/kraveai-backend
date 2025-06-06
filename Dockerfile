# Imagen base oficial de Node
FROM node:20-slim

# Instala Chromium y dependencias mínimas
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libgbm1 \
    libglib2.0-0 \
    libnss3 \
    libx11-6 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libxss1 \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# Configura Puppeteer
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Crea directorio de trabajo
WORKDIR /app

# Copia dependencias y las instala
COPY package.json package-lock.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copia todo el código fuente
COPY . .

# Expone el puerto de la app
EXPOSE 3000

# Comando para iniciar
CMD ["npm", "start"]