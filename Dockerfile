# Usa la imagen base node:20-slim para un tamaño mínimo
FROM node:20-slim

# Establece el directorio de trabajo
WORKDIR /app

# Instala herramientas necesarias para npm
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/* /tmp/*

# Copia los archivos de paquetes primero para aprovechar el caché de Docker
COPY package.json package-lock.json* ./

# Limpia el caché de npm y fuerza la instalación de dependencias
RUN npm cache clean --force && \
    npm install --omit=dev --verbose

# Instala dependencias de Chrome y herramientas necesarias en una sola capa
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    xdg-utils \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/* /tmp/*

# Copia el código de la aplicación
COPY . .

# Variables de entorno para Puppeteer y Node.js
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV NODE_ENV=production

# Crea un usuario no-root para mayor seguridad
RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

# Expone el puerto
EXPOSE 3000

# Agrega un healthcheck para monitorear la aplicación
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Ejecuta la aplicación
CMD ["npm", "start"]