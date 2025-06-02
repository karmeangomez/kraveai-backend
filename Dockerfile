FROM node:18-alpine

# Actualiza npm primero
RUN npm install -g npm@latest

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
CMD ["node", "server.js"]
