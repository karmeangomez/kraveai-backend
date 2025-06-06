# ✅ Dockerfile limpio y funcional para Railway
FROM node:20-slim

# Instala Chromium y dependencias mínimas necesarias para Puppeteer
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

# Configura Puppeteer para que use el Chromium instalado en el sistema
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Establece el directorio de trabajo
WORKDIR /app

# Copia archivos de dependencias
COPY package.json package-lock.json ./

# Instala solo las dependencias necesarias para producción
RUN npm install --omit=dev && npm cache clean --force

# Copia el resto del proyecto
COPY . .

# Expone el puerto de escucha de la app
EXPOSE 3000

# Comando para iniciar el backend
CMD ["npm", "start"]
