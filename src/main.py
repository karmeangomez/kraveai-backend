import os
import sys
import json
import threading
import logging
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from pydantic import BaseModel
from instagrapi import Client
import uvicorn

# Ajuste PYTHONPATH para src
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Utilidades propias
from utils.telegram_utils import notify_telegram

# Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    handlers=[
        logging.FileHandler("kraveai.log", encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("KraveAI-Backend")

# Variables Entorno
load_dotenv(".env")
IG_USERNAME = os.getenv("IG_USERNAME")
IG_PASSWORD = os.getenv("INSTAGRAM_PASS")

# Backend FastAPI
app = FastAPI(title="KraveAI Backend", version="2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://kraveai.netlify.app",
        "http://localhost:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Estado Global
MAX_CONCURRENT = 3
clients = {}

def iniciar_sesion(usuario, contrasena):
    try:
        cl = Client()
        cl.login(usuario, contrasena)
        cl.dump_settings(f"ig_session_{usuario}.json")
        logger.info(f"✅ Login exitoso como @{usuario}")
        return cl
    except Exception as e:
        logger.error(f"❌ Fallo login @{usuario}: {str(e)}")
        return None


def cargar_cuentas_guardadas():
    path = os.path.join(os.path.dirname(__file__), "cuentas_creadas.json")
    if not os.path.exists(path):
        return
    with open(path, "r", encoding="utf-8") as f:
        cuentas = json.load(f)
        for cuenta in cuentas:
            usuario = cuenta.get("usuario")
            contrasena = cuenta.get("contrasena")
            if usuario and contrasena:
                cl = iniciar_sesion(usuario, contrasena)
                if cl:
                    clients[usuario] = cl
                    logger.info(f"✅ {usuario} listo para órdenes")


def iniciar_bot_busqueda():
    global clients
    cl = None
    if IG_USERNAME and IG_PASSWORD:
        cl = iniciar_sesion(IG_USERNAME, IG_PASSWORD)
        if cl:
            clients["kraveaibot"] = cl
            logger.info(f"🔎 kraveaibot iniciado para búsquedas")
    else:
        logger.error("❌ IG_USERNAME o INSTAGRAM_PASS no definidos en .env")


@app.get("/health")
def health():
    return {
        "status": "OK",
        "versión": "v2.0 - estable",
        "service": "KraveAI Python",
        "login": "Activo" if "kraveaibot" in clients else "Fallido",
        "cuentas_cargadas": len(clients)
    }


@app.get("/test-telegram")
def test_telegram():
    try:
        notify_telegram("📲 Prueba desde /test-telegram")
        return {"mensaje": "Telegram notificado correctamente"}
    except Exception as e:
        logger.error(f"Error test-telegram: {str(e)}")
        raise HTTPException(status_code=500, detail="Error notificando Telegram")


@app.get("/estado-sesion")
def estado_sesion():
    cl = clients.get("kraveaibot")
    if cl:
        return {"status": "activo", "usuario": IG_USERNAME}
    return {"status": "inactivo"}


class LoginRequest(BaseModel):
    usuario: str
    contrasena: str


@app.post("/iniciar-sesion")
def iniciar_sesion_manual(datos: LoginRequest):
    cl = iniciar_sesion(datos.usuario, datos.contrasena)
    if cl:
        clients[datos.usuario] = cl
        notify_telegram(f"✅ Sesión iniciada manualmente como @{datos.usuario}")
        return {"exito": True, "usuario": datos.usuario}
    return JSONResponse(
        status_code=401,
        content={"exito": False, "mensaje": "Error: Verifica manualmente en Instagram."}
    )


@app.get("/cerrar-sesion")
def cerrar_sesion():
    global clients
    try:
        if "kraveaibot" in clients:
            clients["kraveaibot"].logout()
            del clients["kraveaibot"]
            logger.info("kraveaibot cerró sesión")
        return {"exito": True}
    except Exception as e:
        logger.error(f"Error cerrar sesión: {str(e)}")
        return JSONResponse(status_code=500, content={"exito": False})


class GuardarCuentaRequest(BaseModel):
    usuario: str
    contrasena: str


@app.post("/guardar-cuenta")
def guardar_cuenta(datos: GuardarCuentaRequest):
    path = os.path.join(os.path.dirname(__file__), "cuentas_creadas.json")
    cuentas = []

    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                cuentas = json.load(f)
        except:
            pass

    for cuenta in cuentas:
        if cuenta["usuario"] == datos.usuario:
            return JSONResponse(status_code=400, content={"exito": False, "mensaje": "Cuenta ya guardada."})

    cuentas.append({
        "usuario": datos.usuario,
        "contrasena": datos.contrasena
    })

    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(cuentas, f, ensure_ascii=False, indent=4)
        return {"exito": True, "mensaje": "Cuenta guardada correctamente"}
    except Exception as e:
        logger.error(f"Error guardando cuenta: {str(e)}")
        return JSONResponse(status_code=500, content={"exito": False, "mensaje": "Error al guardar"})


@app.get("/buscar-usuario")
def buscar_usuario(username: str):
    cl = clients.get("kraveaibot")
    if not cl:
        return JSONResponse(status_code=401, content={"error": "kraveaibot no activo"})
    try:
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
        return JSONResponse(status_code=404, content={"error": "No encontrado o sesión inválida"})


def run_uvicorn():
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        reload=False,
        workers=1
    )


def startup():
    iniciar_bot_busqueda()
    cargar_cuentas_guardadas()


if __name__ == "__main__":
    threading.Thread(target=startup).start()
    run_uvicorn()
else:
    startup()
