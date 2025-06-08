# Etapa 1: Build
FROM node:20-slim AS builder

WORKDIR /app

# Instala herramientas de compilación (opcional, si tus dependencias lo requieren)
RUN apt-get update && apt-get install -y build-essential

# Copia package.json y package-lock.json
COPY package.json package-lock.json ./

# Instala dependencias sin las de desarrollo
RUN npm ci --omit=dev

# Etapa 2: Producción final
FROM node:20-slim

WORKDIR /app

# Copia los node_modules desde la etapa builder
COPY --from=builder /app/node_modules ./node_modules
COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
