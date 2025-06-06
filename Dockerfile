FROM node:20-slim

# 1. Instala Chromium y dependencias mínimas (y herramientas de compilación)
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

# 2. Configura Puppeteer (versión simplificada)
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# 3. Directorio de trabajo
WORKDIR /app

# 4. Copia primero solo dependencias
COPY package.json package-lock.json* ./

# 5. Instala dependencias de producción
RUN npm install --omit=dev && npm cache clean --force

# 6. Copia el resto del proyecto
COPY . .

# 7. Expone el puerto
EXPOSE 3000

# 8. Comando de inicio
CMD ["npm", "start"]