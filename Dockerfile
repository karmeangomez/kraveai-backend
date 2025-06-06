# Usar una imagen base con Chromium preinstalado
FROM puppeteer/puppeteer:latest

# Configurar variables de entorno para Puppeteer
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

WORKDIR /app

# Copiar archivos de dependencias para aprovechar el caché
COPY package.json package-lock.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copiar el resto del proyecto
COPY . .

EXPOSE 3000

CMD ["npm", "start"]
