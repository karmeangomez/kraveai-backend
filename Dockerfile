FROM node:18-bullseye-slim

WORKDIR /usr/src/app

# Instala Chromium (para puppeteer-core)
RUN apt-get update && apt-get install -y chromium

# Instala dependencias Node
COPY package*.json ./
RUN npm install

# Copia el resto del código
COPY . .

# Variables necesarias
ENV CHROMIUM_PATH=/usr/bin/chromium
ENV PORT=3000

EXPOSE 3000
CMD ["npm", "start"]
