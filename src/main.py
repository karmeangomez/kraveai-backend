# src/main.py

import os
import json
import logging
from fastapi import FastAPI, Request, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from login_utils import login_instagram, guardar_sesion, cargar_sesion
from instagrapi.exceptions import ChallengeRequired, LoginRequired

load_dotenv()

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

cliente_principal = None
CUENTAS_MANUALES = "cuentas_creadas.json"


def cargar_cuentas_guardadas():
    if not os.path.exists(CUENTAS_MANUALES):
        return []
    with open(CUENTAS_MANUALES, "r") as f:
        return json.load(f)


@app.on_event("startup")
def iniciar_sesion_principal():
    global cliente_principal
    usuario = os.getenv("KRAVE_USER")
    contraseña = os.getenv("KRAVE_PASS")
    proxy = os.getenv("KRAVE_PROXY")

    cliente = cargar_sesion(usuario)
    if cliente:
        cliente_principal = cliente
        return

    try:
        cliente = login_instagram(usuario, contraseña, proxy)
        guardar_sesion(cliente, usuario)
        cliente_principal = cliente
    except Exception as e:
        logging.error(f"Error al iniciar sesión principal: {e}")
        cliente_principal = None


@app.get("/health")
def health():
    estado = {"status": "OK"}
    if cliente_principal:
        estado["accounts"] = ["krave"]
    return estado


@app.get("/estado-sesion")
def estado_sesion():
    return {"logueado": cliente_principal is not None}


@app.post("/iniciar-sesion")
async def iniciar_sesion(request: Request):
    datos = await request.json()
    usuario = datos.get("usuario")
    contraseña = datos.get("contraseña")
    proxy = datos.get("proxy")

    if not usuario or not contraseña:
        raise HTTPException(status_code=400, detail="Faltan credenciales")

    try:
        cliente = login_instagram(usuario, contraseña, proxy)
        guardar_sesion(cliente, usuario)

        cuentas = cargar_cuentas_guardadas()
        if usuario not in cuentas:
            cuentas.append(usuario)
            with open(CUENTAS_MANUALES, "w") as f:
                json.dump(cuentas, f)

        return {"mensaje": "Sesión iniciada", "usuario": usuario}
    except ChallengeRequired:
        raise HTTPException(status_code=403, detail="ChallengeRequired")
    except LoginRequired:
        raise HTTPException(status_code=403, detail="LoginRequired")
    except Exception as e:
        logging.error(f"Error al iniciar sesión: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/buscar-usuario")
def buscar_usuario(username: str = Query(...)):
    if not cliente_principal:
        return JSONResponse(content={"error": "No hay sesión activa"}, status_code=401)
    try:
        user = cliente_principal.user_info_by_username(username)
        return user.dict()
    except Exception as e:
        logging.error(f"Error al buscar usuario {username}: {e}")
        return JSONResponse(content={"error": str(e)}, status_code=500)


@app.get("/cuentas-activas")
def cuentas_activas():
    cuentas = cargar_cuentas_guardadas()
    return {"cuentas": cuentas}
