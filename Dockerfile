# ✅ Dockerfile para Railway con Puppeteer y proxy-chain
FROM node:20-slim

# 1. Instala Chromium y dependencias mínimas
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

# 2. Variables Puppeteer
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# 3. Directorio de trabajo
WORKDIR /app

# 4. Copia dependencias y las instala
COPY package.json .
RUN npm install --omit=dev && npm cache clean --force

# 5. Copia el resto del proyecto
COPY . .

# 6. Exponer puerto y arrancar
EXPOSE 3000
CMD ["npm", "start"]
