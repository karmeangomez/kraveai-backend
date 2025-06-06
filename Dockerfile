FROM node:20-slim

# 1. Instala Chromium y dependencias mínimas (reducido a solo lo esencial)
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
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# 2. Configura Puppeteer (versión simplificada)
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# 3. Configura el directorio de trabajo
WORKDIR /app

# 4. Copia solo package.json primero para mejor caché de Docker
COPY package.json .

# 5. Instala dependencias (con limpia automática de caché)
RUN npm install --omit=dev \
    && npm cache clean --force

# 6. Copia el resto de la aplicación (excluyendo node_modules)
COPY . .

# 7. Expone el puerto
EXPOSE 3000

# 8. Inicia la aplicación
CMD ["npm", "start"]
