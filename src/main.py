import os
import json
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from login_utils import (
    login_instagram,
    restaurar_sesion,
    guardar_sesion,
    cuentas_activas,
)

load_dotenv()
app = FastAPI()

# Permitir acceso desde el frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # o tu Netlify
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok"}

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
            return {"status": "ok"}
    except Exception as e:
        return {"error": str(e)}

    return {"error": "Login fallido"}

@app.get("/cuentas-activas")
def obtener_cuentas():
    return {"cuentas": cuentas_activas()}
