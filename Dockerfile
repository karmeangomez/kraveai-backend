FROM node:18-bullseye-slim

WORKDIR /usr/src/app

# 🛠 Instalar dependencias del sistema
RUN apt-get update && \
    apt-get install -y \
    chromium \
    libgbm-dev \
    libxshmfence-dev \
    libglib2.0-0 \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libgtk-3-0 \
    libasound2 \
    --no-install-recommends

# 📦 Copiar e instalar dependencias Node.js
COPY package*.json ./
RUN npm install --production

# 📂 Copiar código fuente
COPY . .

# 🔧 Configuración de entorno
ENV CHROMIUM_PATH=/usr/bin/chromium
ENV PORT=3000

EXPOSE ${PORT}
CMD ["npm", "start"]
