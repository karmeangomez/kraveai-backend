import os
import json
import logging
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from instagrapi import Client
import threading
import uvicorn

# === Paths ===
BASE_PATH = Path(__file__).resolve().parent.parent
CREADAS_PATH = BASE_PATH / "cuentas_creadas.json"
ACTIVAS_PATH = BASE_PATH / "cuentas_activas.json"
SESIONES_DIR = BASE_PATH / "sesiones"
SESIONES_DIR.mkdir(exist_ok=True)

# === Env ===
env_path = BASE_PATH / ".env"
load_dotenv(env_path)
print(f"✅ Variables de entorno cargadas desde: {env_path}")

# === Logging ===
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s]: %(message)s',
)
logger = logging.getLogger("KraveAI")

app = FastAPI(title="KraveAI Backend", version="2.3")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://kraveai.netlify.app", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# === Global ===
cl = None


# === Modelos ===
class GuardarCuentaRequest(BaseModel):
    usuario: str
    contrasena: str


class LoginRequest(BaseModel):
    usuario: str
    contrasena: str


# === Funciones ===
def iniciar_cuentas_guardadas():
    activas = []
    if not CREADAS_PATH.exists():
        logger.warning("No existe cuentas_creadas.json")
        return
    with open(CREADAS_PATH, "r", encoding="utf-8") as f:
        cuentas = json.load(f)
    for cuenta in cuentas:
        usuario = cuenta["usuario"]
        password = cuenta["contrasena"]
        session_path = SESIONES_DIR / f"ig_session_{usuario}.json"
        client = Client()
        try:
            client.login(usuario, password)
            client.dump_settings(session_path)
            activas.append({"usuario": usuario})
            logger.info(f"✅ Activa: @{usuario}")
        except Exception as e:
            logger.warning(f"❌ @{usuario} no se pudo iniciar sesión -> {e}")
            continue
    with open(ACTIVAS_PATH, "w", encoding="utf-8") as f:
        json.dump(activas, f, ensure_ascii=False, indent=4)


# === Endpoints ===
@app.get("/health")
def health():
    auth_status = "Fallido"
    try:
        if cl:
            auth_data = cl.get_settings().get("authorization_data", {})
            if auth_data.get("ds_user_id") and auth_data.get("sessionid"):
                auth_status = f"Activo (@{cl.username})"
    except Exception as e:
        logger.warning(f"Error en /health: {e}")
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
        if cl:
            auth_data = cl.get_settings().get("authorization_data", {})
            if auth_data.get("ds_user_id") and auth_data.get("sessionid"):
                return {"status": "activo", "usuario": cl.username}
        return {"status": "inactivo"}
    except Exception as e:
        logger.error(f"Error en estado-sesion: {str(e)}")
        return {"status": "inactivo", "error": str(e)}


@app.post("/guardar-cuenta")
def guardar_cuenta(datos: GuardarCuentaRequest):
    cuentas = []
    if CREADAS_PATH.exists():
        try:
            with open(CREADAS_PATH, "r", encoding="utf-8") as f:
                cuentas = json.load(f)
        except:
            pass
    for cuenta in cuentas:
        if cuenta["usuario"] == datos.usuario:
            return JSONResponse(status_code=400, content={"exito": False, "mensaje": "Cuenta ya guardada."})
    cuentas.append({"usuario": datos.usuario, "contrasena": datos.contrasena})
    try:
        with open(CREADAS_PATH, "w", encoding="utf-8") as f:
            json.dump(cuentas, f, ensure_ascii=False, indent=4)
        return {"exito": True, "mensaje": "Cuenta guardada correctamente"}
    except Exception as e:
        logger.error(f"Error guardando cuenta: {str(e)}")
        return JSONResponse(status_code=500, content={"exito": False, "mensaje": "Error interno al guardar"})


@app.post("/iniciar-sesion")
def iniciar_sesion(datos: LoginRequest):
    session_path = SESIONES_DIR / f"ig_session_{datos.usuario}.json"
    client = Client()
    try:
        client.login(datos.usuario, datos.contrasena)
        client.dump_settings(session_path)
        if ACTIVAS_PATH.exists():
            with open(ACTIVAS_PATH, "r", encoding="utf-8") as f:
                activas = json.load(f)
        else:
            activas = []

        if {"usuario": datos.usuario} not in activas:
            activas.append({"usuario": datos.usuario})

        with open(ACTIVAS_PATH, "w", encoding="utf-8") as f:
            json.dump(activas, f, ensure_ascii=False, indent=4)

        logger.info(f"✅ Sesión iniciada y guardada para @{datos.usuario}")
        return {"exito": True, "usuario": datos.usuario}
    except Exception as e:
        logger.error(f"❌ Error iniciando sesión para @{datos.usuario}: {str(e)}")
        return JSONResponse(status_code=401, content={"exito": False, "mensaje": str(e)})


# === Startup ===
@app.on_event("startup")
def startup_event():
    global cl
    threading.Thread(target=iniciar_cuentas_guardadas, daemon=True).start()
    cl = Client()
    try:
        IG_USERNAME = os.getenv("IG_USERNAME")
        IG_PASSWORD = os.getenv("INSTAGRAM_PASS")
        if IG_USERNAME and IG_PASSWORD:
            cl.login(IG_USERNAME, IG_PASSWORD)
            logger.info(f"KraveAI conectado como @{cl.username}")
    except Exception as e:
        logger.warning(f"No se pudo iniciar sesión en cuenta principal: {e}")


def run_uvicorn():
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)


if __name__ == "__main__":
    run_uvicorn()
