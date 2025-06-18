# main.py - Backend principal KraveAI (Versión Maximizada)
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

# Configuración de logging
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

# Configuración específica para Raspberry Pi
MAX_CONCURRENT = 3  # Máximo seguro para Raspberry Pi

# Inicialización segura de cliente Instagram
try:
    cl = login_instagram()
    logger.info("Cliente Instagram inicializado")
except Exception as e:
    logger.error(f"Error inicializando Instagram: {str(e)}")
    cl = None

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En producción puedes restringir a tu dominio exacto
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {
        "status": "OK",
        "versión": "v1.7 - actualizado 2025-06-18",
        "service": "KraveAI Python",
        "login": "Activo" if cl and cl.user_id else "Fallido",
        "concurrent_max": MAX_CONCURRENT
    }

@app.get("/estado-sesion")
def estado_sesion():
    if cl and cl.user_id:
        return {"status": "activo", "usuario": cl.username}
    return {"status": "inactivo", "detalle": "Sesión no iniciada o expirada"}

class LoginRequest(BaseModel):
    usuario: str
    contrasena: str

@app.post("/iniciar-sesion")
def iniciar_sesion_post(datos: LoginRequest):
    from instagrapi import Client
    global cl

    try:
        nuevo = Client()
        nuevo.login(datos.usuario, datos.contrasena)
        cl = nuevo
        cl.dump_settings("ig_session.json")
        notify_telegram(f"✅ Sesión iniciada como @{datos.usuario}")
        logger.info(f"Sesión Instagram iniciada: @{datos.usuario}")
        return {"exito": True, "usuario": datos.usuario}
    except Exception as e:
        logger.error(f"Error inicio sesión: {str(e)}")
        return JSONResponse(
            status_code=401,
            content={"exito": False, "mensaje": f"Error de autenticación: {str(e)}"}
        )

@app.get("/cerrar-sesion")
def cerrar_sesion():
    try:
        global cl
        if cl:
            cl.logout()
            cl = None
        if os.path.exists("ig_session.json"):
            os.remove("ig_session.json")
        notify_telegram("👋 Sesión cerrada correctamente")
        logger.info("Sesión Instagram cerrada")
        return {"exito": True}
    except Exception as e:
        logger.error(f"Error cerrando sesión: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"exito": False, "mensaje": f"No se pudo cerrar sesión: {str(e)}"}
        )

@app.get("/buscar-usuario")
def buscar_usuario(username: str):
    try:
        if not cl or not cl.user_id:
            return JSONResponse(
                status_code=401,
                content={"error": "Sesión de Instagram no activa"}
            )

        user = cl.user_info_by_username(username)
        return {
            "username": user.username,
            "nombre": user.full_name,
            "foto": user.profile_pic_url,
            "publicaciones": user.media_count,
            "seguidores": user.follower_count,
            "seguidos": user.following_count,
            "biografia": user.biography,
            "privado": user.is_private,
            "verificado": user.is_verified,
            "negocio": user.is_business
        }
    except Exception as e:
        logger.error(f"Error buscando usuario @{username}: {str(e)}")
        return JSONResponse(
            status_code=404,
            content={"error": f"No se pudo obtener información del usuario: {str(e)}"}
        )

# Este endpoint no tenía problema para el túnel. Si no conecta, revisa:
# - Si Uvicorn usa host="0.0.0.0"
# - Si Cloudflare Tunnel apunta al puerto correcto
# - Si el dominio externo redirige bien (revisar /health)
# - Si Netlify usa HTTPS y tú estás en HTTP (Mixed Content)

# --- Al final del archivo ---
if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))

    # Configuración optimizada para Raspberry Pi
    uvicorn.run(
        "main:app",
        host="0.0.0.0",  # ✅ NECESARIO para que escuche conexiones externas
        port=port,
        reload=False,
        workers=1,
        timeout_keep_alive=30,
        limit_concurrency=8
    )
