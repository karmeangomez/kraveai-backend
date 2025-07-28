import os
import json
import logging
from fastapi import FastAPI, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pydantic import BaseModel
from src.login_utils import login_instagram, restaurar_sesion, guardar_sesion, verificar_sesion
from instagrapi.exceptions import LoginRequired

load_dotenv()

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CUENTAS_JSON = "cuentas_creadas.json"
clientes_instagram = {}

# Modelos
class LoginData(BaseModel):
    username: str
    password: str

class CuentaData(BaseModel):
    username: str
    password: str

# Utils
def cargar_cuentas():
    if not os.path.exists(CUENTAS_JSON):
        return []
    with open(CUENTAS_JSON, "r") as f:
        return json.load(f)

def guardar_cuenta_json(username, password):
    cuentas = cargar_cuentas()
    if any(c['username'] == username for c in cuentas):
        return
    cuentas.append({'username': username, 'password': password})
    with open(CUENTAS_JSON, "w") as f:
        json.dump(cuentas, f, indent=2)

# Rutas
@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/estado-sesion")
def estado_sesion():
    krave_user = os.getenv("INSTA_USER")
    cl = clientes_instagram.get(krave_user)
    if cl and verificar_sesion(cl, krave_user):
        return {"status": "activo", "usuario": krave_user}
    return {"status": "inactivo"}

@app.post("/iniciar-sesion")
def iniciar_sesion(data: LoginData):
    cl = login_instagram(data.username, data.password)
    if cl:
        clientes_instagram[data.username] = cl
        guardar_cuenta_json(data.username, data.password)
        guardar_sesion(cl, data.username)
        return {"status": "ok", "usuario": data.username}
    return {"status": "error", "detalle": "No se pudo iniciar sesión"}

@app.post("/guardar-cuenta")
def guardar_cuenta(data: CuentaData):
    cl = login_instagram(data.username, data.password)
    if cl:
        clientes_instagram[data.username] = cl
        guardar_cuenta_json(data.username, data.password)
        guardar_sesion(cl, data.username)
        return {"status": "ok"}
    return {"status": "error", "detalle": "Login fallido"}

@app.get("/buscar-usuario")
def buscar_usuario(username: str = Query(...)):
    krave_user = os.getenv("INSTA_USER")
    cl = clientes_instagram.get(krave_user)
    if cl:
        try:
            user_info = cl.user_info_by_username_v1(username)
            return {"status": "ok", "usuario": user_info.dict()}
        except Exception as e:
            return {"status": "error", "detalle": str(e)}
    return {"status": "error", "detalle": "Sesión kraveaibot no activa"}

@app.get("/cuentas-activas")
def cuentas_activas():
    activas = []
    for usuario, cl in clientes_instagram.items():
        if verificar_sesion(cl, usuario):
            activas.append(usuario)
    return {"status": "ok", "cuentas": activas}

# Autocargar sesiones
@app.on_event("startup")
def cargar_sesiones_guardadas():
    cuentas = cargar_cuentas()
    for cuenta in cuentas:
        try:
            cl = restaurar_sesion(cuenta["username"], cuenta["password"])
            if cl:
                clientes_instagram[cuenta["username"]] = cl
        except Exception:
            continue

    # También carga sesión principal kraveaibot
    krave_user = os.getenv("INSTA_USER")
    krave_pass = os.getenv("INSTA_PASS")
    if krave_user and krave_pass:
        try:
            cl = restaurar_sesion(krave_user, krave_pass)
            if cl:
                clientes_instagram[krave_user] = cl
        except Exception:
            pass
