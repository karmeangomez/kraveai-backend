import os
import json
import logging
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from login_utils import login_instagram, guardar_sesion, restaurar_sesion

# Configuración básica
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("kraveai_backend")

app = FastAPI()

# Configuración CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Variables globales
CUENTAS_FILE = "cuentas_creadas.json"
KRAVE_USER = os.getenv("INSTA_USER", "kraveaibot")
KRAVE_PASS = os.getenv("INSTA_PASS", "tu_contraseña")
sesiones_activas = {}

class Credenciales(BaseModel):
    username: str
    password: str

def cargar_cuentas():
    """Carga las cuentas guardadas"""
    if not os.path.exists(CUENTAS_FILE):
        return []
    
    try:
        with open(CUENTAS_FILE, "r") as f:
            return json.load(f)
    except:
        return []

def guardar_cuenta(username):
    """Guarda una nueva cuenta en el registro"""
    cuentas = cargar_cuentas()
    if username not in cuentas:
        cuentas.append(username)
        with open(CUENTAS_FILE, "w") as f:
            json.dump(cuentas, f, indent=2)

@app.on_event("startup")
def iniciar_sesiones():
    """Inicia sesiones al arrancar la aplicación"""
    logger.info("⏳ Iniciando sesiones guardadas...")
    
    # Sesión principal
    if KRAVE_USER and KRAVE_PASS:
        cl = restaurar_sesion(KRAVE_USER, KRAVE_PASS)
        if cl:
            sesiones_activas[KRAVE_USER] = cl
            logger.info(f"✅ Sesión principal activa: {KRAVE_USER}")
    
    # Otras cuentas
    for cuenta in cargar_cuentas():
        if cuenta == KRAVE_USER:
            continue
        cl = restaurar_sesion(cuenta, None)
        if cl:
            sesiones_activas[cuenta] = cl
            logger.info(f"✅ Sesión activa: {cuenta}")

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/estado-sesion")
def estado_sesion():
    cl = sesiones_activas.get(KRAVE_USER)
    return {"activa": cl is not None, "usuario": KRAVE_USER}

@app.post("/iniciar-sesion")
def iniciar_sesion(data: Credenciales):
    cl = login_instagram(data.username, data.password)
    if cl:
        guardar_sesion(cl, data.username)
        sesiones_activas[data.username] = cl
        guardar_cuenta(data.username)
        return {"status": "ok", "message": "Sesión iniciada"}
    return {"status": "error", "message": "Login fallido"}

@app.post("/guardar-cuenta")
def guardar_cuenta_endpoint(data: Credenciales):
    # Verificar si ya está activa
    if data.username in sesiones_activas:
        return {"status": "ok", "message": "Cuenta ya activa"}
    
    # Intentar login
    cl = login_instagram(data.username, data.password)
    if cl:
        guardar_sesion(cl, data.username)
        sesiones_activas[data.username] = cl
        guardar_cuenta(data.username)
        return {"status": "ok", "message": "Cuenta guardada"}
    return {"status": "error", "message": "Login fallido"}

@app.get("/cuentas-activas")
def cuentas_activas():
    return {"cuentas": list(sesiones_activas.keys())}

@app.get("/buscar-usuario")
def buscar_usuario(username: str = Query(...)):
    cl = sesiones_activas.get(KRAVE_USER)
    if not cl:
        return {"status": "error", "message": "Sesión principal inactiva"}
    
    try:
        user = cl.user_info_by_username(username)
        return {
            "username": user.username,
            "full_name": user.full_name,
            "follower_count": user.follower_count,
            "is_private": user.is_private,
            "profile_pic_url": user.profile_pic_url
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}
