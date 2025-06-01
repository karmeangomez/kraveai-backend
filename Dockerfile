FROM node:20-slim

# Instala dependencias necesarias para Chromium
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libgbm1 \
    libgtk-3-0 \
    libnss3 \
    libxss1 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Crea carpeta y copia el proyecto
WORKDIR /app
COPY . .

# Instala dependencias Node
RUN npm install

# Expone el puerto (usa tu puerto .env o por defecto 3000)
EXPOSE 3000

# Inicia el servidor
CMD ["node", "server.js"]
