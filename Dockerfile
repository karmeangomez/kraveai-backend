# Usa una imagen ligera de Node
FROM node:18-slim

# Instala librerías necesarias para Chromium en entorno Render
RUN apt-get update && apt-get install -y \
    wget \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libgdk-pixbuf2.0-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm-dev \
    xdg-utils \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# Establece el directorio de trabajo
WORKDIR /app

# Copia los archivos de dependencias
COPY package*.json ./

# Instala las dependencias (usa legacy-peer-deps por compatibilidad)
RUN npm install --legacy-peer-deps

# Copia el resto de los archivos de la app
COPY . .

# Expone el puerto que usará el servidor
EXPOSE 3000

# Comando de inicio
CMD ["npm", "start"]
