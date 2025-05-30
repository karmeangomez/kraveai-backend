FROM node:18-bullseye-slim

WORKDIR /usr/src/app

# Instalar Chromium
RUN apt-get update && apt-get install -y chromium

COPY package*.json ./
RUN npm install

COPY . .

ENV CHROMIUM_PATH=/usr/bin/chromium
ENV PORT=3000

EXPOSE 3000
CMD ["npm", "start"]
