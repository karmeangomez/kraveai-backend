# Usa imagen base ligera compatible con Puppeteer
FROM node:20-slim

# Instala dependencias del sistema necesarias para Chromium
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
  xdg-utils \
  --no-install-recommends && \
  rm -rf /var/lib/apt/lists/*

# Directorio de trabajo
WORKDIR /app

# Copia los archivos del proyecto
COPY . .

# Instala dependencias de Node.js
RUN npm install

# Asegura que Puppeteer descargue Chromium en entorno Docker
RUN npx puppeteer install

# Expone el puerto
EXPOSE 3000

# Comando para iniciar el servidor
CMD ["node", "server.js"]
