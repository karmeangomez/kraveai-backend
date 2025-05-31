FROM node:18-bullseye

WORKDIR /app

RUN apt-get update && apt-get install -y chromium

COPY package*.json ./
RUN npm install
COPY . .

ENV CHROMIUM_PATH=/usr/bin/chromium
EXPOSE 3000
CMD ["node", "server.js"]
