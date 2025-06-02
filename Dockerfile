# 🔧 Imagen base optimizada
FROM node:20-slim

# 📦 Instalar librerías requeridas para Chromium
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

# 📂 Crear carpeta de trabajo
WORKDIR /app

# 📦 Copiar archivos y usar modo tolerante para dependencias
COPY package*.json ./
RUN npm install --legacy-peer-deps

# 🚀 Copiar todo lo demás
COPY . .

# 🌐 Exponer el puerto
EXPOSE 3000

# ▶️ Ejecutar backend
CMD ["node", "server.js"]
