FROM node:18-slim

# Instalar Chromium manualmente
RUN apt-get update && apt-get install -y chromium

WORKDIR /app

COPY package*.json ./
RUN npm install
COPY . .

ENV CHROMIUM_PATH=/usr/bin/chromium
EXPOSE 3000

CMD ["node", "server.js"]
