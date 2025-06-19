# main.py - Versión Corregida con Todos los Endpoints
import os
import json
import asyncio
import subprocess
import logging
import concurrent.futures
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, PlainTextResponse, JSONResponse
from dotenv import load_dotenv
from pydantic import BaseModel
from login_utils import login_instagram
from telegram_utils import notify_telegram
from instagram_utils import crear_cuenta_instagram

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    handlers=[
        logging.FileHandler("kraveai.log", encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("KraveAI-Backend")

load_dotenv()
app = FastAPI()
MAX_CONCURRENT = 3

try:
    cl = login_instagram()
    logger.info("Cliente Instagram inicializado")
except Exception as e:
    logger.error(f"Error inicializando Instagram: {str(e)}")
    cl = None

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://kraveai.netlify.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

@app.get("/test-telegram")
def test_telegram():
    try:
        notify_telegram("📲 Prueba de conexión con Telegram desde /test-telegram")
        return JSONResponse(
            content={"mensaje": "Telegram notificado correctamente"},
            headers={"Access-Control-Allow-Origin": "https://kraveai.netlify.app"}
        )
    except Exception as e:
        logger.error(f"Error en test-telegram: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"error": "Error enviando notificación a Telegram"},
            headers={"Access-Control-Allow-Origin": "https://kraveai.netlify.app"}
        )

@app.get("/create-accounts-sse")
async def crear_cuentas_sse(request: Request, count: int = 1):
    async def event_stream():
        for i in range(count):
            yield f"event: progress\ndata: {{\"message\": \"Creando cuenta {i+1}\"}}\n\n"
            await asyncio.sleep(1)
        yield "event: complete\ndata: Proceso terminado\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Access-Control-Allow-Origin": "https://kraveai.netlify.app",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
        }
    )

@app.get("/estado-sesion")
def estado_sesion():
    if cl and cl.user_id:
        return JSONResponse(
            content={"status": "activo", "usuario": cl.username},
            headers={"Access-Control-Allow-Origin": "https://kraveai.netlify.app"}
        )
    return JSONResponse(
        content={"status": "inactivo"},
        headers={"Access-Control-Allow-Origin": "https://kraveai.netlify.app"}
    )

@app.post("/iniciar-sesion")
def iniciar_sesion_post(datos: dict):
    return JSONResponse(content={"mensaje": "Inicio de sesión no implementado"})

@app.get("/cerrar-sesion")
def cerrar_sesion():
    return JSONResponse(content={"mensaje": "Cierre de sesión no implementado"})

@app.get("/buscar-usuario")
def buscar_usuario(username: str):
    return JSONResponse(content={"mensaje": f"Búsqueda de {username} no implementada"})

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        reload=False,
        workers=1,
        proxy_headers=True,
        forwarded_allow_ips="*"
    )
