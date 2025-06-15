#!/bin/bash

echo "🔁 Cerrando puerto 8000 (si está en uso)..."
sudo fuser -k 8000/tcp

echo "🚀 Reiniciando servicio kraveai-python..."
sudo systemctl restart kraveai-python.service

sleep 2

echo "🧪 Verificando estado del backend:"
curl http://localhost:8000/health
