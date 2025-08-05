import os
import json
from fastapi import FastAPI, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from src.login_utils import (
    login_instagram,
    restaurar_sesion,
    guardar_sesion,
    guardar_cuenta_api,
    cerrar_sesion,
    cuentas_activas,
    cliente_por_usuario,
    buscar_usuario
)

load_dotenv()
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/estado-sesion")
def estado_sesion():
    cuentas = cuentas_activas()
    if not cuentas:
        return {"sesion_activa": False}
    return {"sesion_activa": True, "cuentas": cuentas}

@app.post("/iniciar-sesion")
async def iniciar_sesion(request: Request):
    datos = await request.json()
    username = datos.get("username")
    password = datos.get("password")
    if not username or not password:
        return {"error": "Faltan credenciales"}

    try:
        cl = login_instagram(username, password)
        if cl:
            guardar_sesion(cl, username)
            guardar_cuenta_api(username, password)
            return {"status": "ok"}
    except Exception as e:
        return {"error": str(e)}

    return {"error": "Login fallido"}

@app.get("/cuentas-activas")
def obtener_cuentas():
    return {"cuentas": cuentas_activas()}

@app.post("/guardar-cuenta")
async def guardar_cuenta(request: Request):
    datos = await request.json()
    username = datos.get("username")
    password = datos.get("password")
    if not username or not password:
        return {"error": "Faltan datos"}
    guardar_cuenta_api(username, password)
    return {"status": "guardado"}

@app.post("/cerrar-sesion")
async def cerrar(request: Request):
    datos = await request.json()
    username = datos.get("username")
    if not username:
        return {"error": "Falta el username"}
    cerrar_sesion(username)
    return {"status": "sesión cerrada"}

@app.get("/buscar-usuario")
def buscar(username: str = Query(...)):
    try:
        resultado = buscar_usuario(username)
        return {"usuario": resultado}
    except Exception as e:
        return {"error": str(e)}
