# Reiniciar backend
pm2 restart backend

# Probar el endpoint
curl -X POST http://localhost:8000/youtube/ordenar-vistas \
  -H "Content-Type: application/json" \
  -d '{
    "video_url": "https://youtu.be/dQw4w9WgXcQ",
    "cantidad": 10
  }'
