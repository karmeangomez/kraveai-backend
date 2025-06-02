# 🔧 Dockerfile - Producción estable para KraveAI Backend

FROM node:20-slim

# Crear directorio app
WORKDIR /app

# Copiar dependencias y código
COPY package*.json ./
COPY . .

# Instalar dependencias
RUN npm install --production

# Puerto expuesto (Render/Railway usan este)
EXPOSE 3000

# Comando de arranque
CMD ["node", "server.js"]
