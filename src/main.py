import os
import json
import logging
from fastapi import FastAPI, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute
from dotenv import load_dotenv
from login_utils import login_instagram, restaurar_sesion
from instagrapi.exceptions import ChallengeRequired, LoginRequired

load_dotenv()

app = FastAPI()
logger = logging.getLogger("KraveAI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

cliente_principal = None

@app.on_event("startup")
def iniciar_sesion_bot():
    global cliente_principal
    usuario = os.getenv("INSTAGRAM_USER")
    password = os.getenv("INSTAGRAM_PASS")
    cliente_principal = restaurar_sesion(usuario)
    if not cliente_principal:
        cliente_principal = login_instagram(usuario, password)
    if cliente_principal:
        logger.info(f"✅ Sesión iniciada con {usuario}")
    else:
        logger.error("❌ No se pudo iniciar sesión principal")

@app.get("/health")
def health():
    return {"status": "OK", "accounts": ["krave"] if cliente_principal else []}

@app.get("/estado-sesion")
def estado_sesion():
    if cliente_principal:
        return {"status": "activa"}
    return JSONResponse(content={"status": "inactiva"}, status_code=401)

@app.get("/buscar-usuario")
def buscar_usuario(username: str = Query(...)):
    if not cliente_principal:
        return JSONResponse(content={"error": "No hay sesión activa"}, status_code=401)
    try:
        user = cliente_principal.user_info_by_username(username)
        return {
            "username": user.username,
            "full_name": user.full_name,
            "followers": user.follower_count,
            "following": user.following_count,
            "biography": user.biography,
            "is_verified": user.is_verified,
        }
    except (ChallengeRequired, LoginRequired):
        return JSONResponse(content={"error": "Sesión inválida"}, status_code=401)
    except Exception as e:
        logger.error(f"Error al buscar usuario: {str(e)}")
        return JSONResponse(content={"error": "Error al buscar usuario"}, status_code=500)

@app.get("/debug-rutas")
def debug_rutas():
    return {
        "rutas": [
            {"ruta": route.path, "metodos": list(route.methods)}
            for route in app.routes if isinstance(route, APIRoute)
        ]
    }
