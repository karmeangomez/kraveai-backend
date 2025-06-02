# Imagen base oficial
FROM node:18

# Instala dependencias del sistema para Puppeteer + Chromium
RUN apt-get update && apt-get install -y \
    wget \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libgdk-pixbuf2.0-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libgtk-3-0 \
    xdg-utils \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# Define directorio de trabajo
WORKDIR /app

# Copia archivos de dependencias primero
COPY package*.json ./

# Instala dependencias sin intentar descargar Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
RUN npm install --legacy-peer-deps

# Copia el resto del código
COPY . .

# Expone el puerto del servidor
EXPOSE 3000

# Comando de arranque
CMD ["npm", "start"]
