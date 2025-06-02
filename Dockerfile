FROM node:20-slim

# Instalar librerías necesarias para Chromium
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

# Definir carpeta de trabajo
WORKDIR /app

# Copiar dependencias
COPY package*.json ./
RUN npm install

# Copiar todo el proyecto
COPY . .

# Exponer el puerto
EXPOSE 3000

# Comando de inicio
CMD ["npm", "start"]
