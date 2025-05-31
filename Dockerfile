# Usa imagen base liviana con Node 18
FROM node:18-bullseye-slim

# Establece el directorio de trabajo
WORKDIR /app

# Instala dependencias necesarias del sistema (Chromium)
RUN apt-get update && \
    apt-get install -y chromium \
    fonts-liberation libappindicator3-1 libasound2 \
    libatk-bridge2.0-0 libatk1.0-0 libcups2 libdbus-1-3 \
    libgdk-pixbuf2.0-0 libnspr4 libnss3 libx11-xcb1 \
    libxcomposite1 libxdamage1 libxrandr2 xdg-utils wget \
    --no-install-recommends && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Copia solo package.json y package-lock.json primero para instalar dependencias
COPY package*.json ./

# Instala dependencias Node.js
RUN npm install --production

# Copia el resto del código
COPY . .

# Define variable de entorno para Puppeteer
ENV CHROMIUM_PATH=/usr/bin/chromium

# Expone el puerto del servidor
EXPOSE 3000

# Comando por defecto para iniciar el backend
CMD ["npm", "start"]
