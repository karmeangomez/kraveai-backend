FROM node:18-bullseye-slim

WORKDIR /usr/src/app

# Instala Chromium funcional para Puppeteer
RUN apt-get update && \
    apt-get install -y wget gnupg ca-certificates fonts-liberation libappindicator3-1 libasound2 \
    libatk-bridge2.0-0 libatk1.0-0 libcups2 libdbus-1-3 libgdk-pixbuf2.0-0 libnspr4 libnss3 \
    libx11-xcb1 libxcomposite1 libxdamage1 libxrandr2 xdg-utils chromium

COPY package*.json ./
RUN npm install

COPY . .

ENV CHROMIUM_PATH=/usr/bin/chromium
ENV PORT=3000

EXPOSE 3000
CMD ["npm", "start"]
