import os
import sys
import json
import logging
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pydantic import BaseModel
import uvicorn
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware as StarletteCORSMiddleware
from src.login_utils import login_instagram  # ✅ CORREGIDO

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s]: %(message)s',
)
logger = logging.getLogger("KraveAI")

load_dotenv(".env")

app = FastAPI(title="KraveAI Backend", version="2.3")
cl = None

def init_instagram():
    global cl
    cl = login_instagram()
    if cl:
        logger.info(f"Cliente Instagram iniciado como @{cl.username}")

app.add_middleware(
    StarletteCORSMiddleware,
    allow_origins=["https://kraveai.netlify.app", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

@app.get("/health")
def health():
    auth_status = "Fallido"
    try:
        if cl:
            auth_data = cl.get_settings().get("authorization_data", {})
            if auth_data.get("ds_user_id") and auth_data.get("sessionid"):
                auth_status = f"Activo (@{cl.username})"
    except:
        pass
    return {
        "status": "OK",
        "versión": "v2.3 - estable",
        "service": "KraveAI Python",
        "login": auth_status
    }

@app.get("/estado-sesion")
def estado_sesion():
    global cl
    try:
        if not cl:
            init_instagram()
        if cl:
            auth_data = cl.get_settings().get("authorization_data", {})
            if auth_data.get("ds_user_id") and auth_data.get("sessionid"):
                return {"status": "activo", "usuario": cl.username}
        return {"status": "inactivo"}
    except Exception as e:
        logger.error(f"Error en estado-sesion: {str(e)}")
        return {"status": "inactivo", "error": str(e)}

class GuardarCuentaRequest(BaseModel):
    usuario: str
    contrasena: str

@app.post("/guardar-cuenta")
def guardar_cuenta(datos: GuardarCuentaRequest):
    path = os.path.join(os.path.dirname(__file__), "../cuentas_creadas.json")
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
    cuentas.append({"usuario": datos.usuario, "contrasena": datos.contrasena})
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(cuentas, f, ensure_ascii=False, indent=4)
        return {"exito": True, "mensaje": "Cuenta guardada correctamente"}
    except Exception as e:
        logger.error(f"Error guardando cuenta: {str(e)}")
        return JSONResponse(status_code=500, content={"exito": False, "mensaje": "Error interno al guardar"})

def run_uvicorn():
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)

if __name__ == "__main__":
    init_instagram()
    run_uvicorn()
else:
    init_instagram()
