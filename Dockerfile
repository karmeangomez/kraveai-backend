FROM node:18-bullseye

WORKDIR /app

# Instalar Chromium
RUN apt-get update && apt-get install -y chromium

# Instalar dependencias
COPY package*.json ./
RUN npm install

# Copiar código fuente
COPY . .

# Variables de entorno para Puppeteer
ENV CHROMIUM_PATH=/usr/bin/chromium
ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "server.js"]
