FROM node:18-slim

# Instalar Chromium
RUN apt-get update && apt-get install -y \
  chromium \
  fonts-liberation \
  libatk-bridge2.0-0 \
  libnss3 \
  libxss1 \
  libasound2 \
  libxshmfence1 \
  --no-install-recommends && \
  apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . .

RUN npm install

ENV CHROMIUM_PATH=/usr/bin/chromium
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "start"]
