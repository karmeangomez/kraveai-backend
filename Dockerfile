# Dockerfile para kraveai-backend

FROM node:18-bullseye-slim

# Instalar dependencias para Chromium
RUN apt-get update && \
    apt-get install -y \
    chromium \
    # ... (resto de dependencias) ...
    && rm -rf /var/lib/apt/lists/*

# Configurar Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV CHROMIUM_PATH=/usr/bin/chromium

# Crear directorio de trabajo
WORKDIR /app

# Copiar archivos del proyecto
COPY package*.json ./
COPY . .

# Instalar dependencias
RUN npm install --production

# Exponer el puerto 10000
EXPOSE 10000

# Comando para iniciar la aplicación - ¡IMPORTANTE!
CMD ["node", "index.js"]  # Asegúrate que dice index.js
