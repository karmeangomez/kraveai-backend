import os
import json
import logging
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from pydantic import BaseModel
from instagrapi import Client
import uvicorn

# .env
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(env_path)

# Logging
logger = logging.getLogger("KraveAI")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(), logging.FileHandler("kraveai.log")]
)
logger.info("✅ Variables de entorno cargadas desde .env")

BASE_PATH = Path(__file__).resolve().parent.parent
SESIONES_DIR = BASE_PATH / "sesiones"
SESIONES_DIR.mkdir(exist_ok=True, parents=True)

app = FastAPI(title="KraveAI Backend", version="2.5")

global_clients = {}

def verificar_sesion_activa(client):
    try:
        if client and client.user_id:
            client.get_timeline_feed()
            return True
        return False
    except Exception:
        return False

def cargar_sesion(username, password=None):
    session_file = SESIONES_DIR / f"ig_session_{username}.json"
    client = Client()
    if session_file.exists():
        try:
            client.load_settings(str(session_file))
            client.login(username, password or "ERROR")
            logger.info(f"🔑 Sesión cargada correctamente: @{username}")
        except Exception as e:
            logger.error(f"❌ No se pudo cargar sesión {username}: {e}")
            return None
    else:
        if password:
            try:
                client.login(username, password)
                client.dump_settings(str(session_file))
                logger.info(f"💾 Sesión guardada: @{username}")
            except Exception as e:
                logger.error(f"❌ Login falló para {username}: {e}")
                return None
        else:
            logger.warning(f"⚠️ No hay sesión ni password para {username}")
            return None
    return client

@app.get("/health")
def health():
    kraveai_client = global_clients.get("kraveaibot")
    status = "Fallido"
    if kraveai_client and verificar_sesion_activa(kraveai_client):
        status = f"Activo (@{kraveai_client.username})"
    return {
        "status": "OK",
        "versión": "v2.5 - estable",
        "service": "KraveAI Python",
        "login": status
    }

class GuardarCuentaRequest(BaseModel):
    usuario: str
    contrasena: str

@app.post("/guardar-cuenta")
def guardar_cuenta(datos: GuardarCuentaRequest):
    cuentas_path = BASE_PATH / "cuentas_creadas.json"
    try:
        cuentas = []
        if cuentas_path.exists():
            with open(cuentas_path, "r", encoding="utf-8") as f:
                cuentas = json.load(f)

        if any(c["usuario"] == datos.usuario for c in cuentas):
            return JSONResponse(
                status_code=400,
                content={"exito": False, "mensaje": "Cuenta ya existe en el sistema"}
            )

        cuentas.append({"usuario": datos.usuario, "contrasena": datos.contrasena})
        with open(cuentas_path, "w", encoding="utf-8") as f:
            json.dump(cuentas, f, ensure_ascii=False, indent=4)

        client = cargar_sesion(datos.usuario, datos.contrasena)
        if client:
            global_clients[datos.usuario] = client
            logger.info(f"✅ Sesión guardada para nueva cuenta: @{datos.usuario}")
            return {"exito": True, "mensaje": "Cuenta registrada y sesión guardada"}

        return {"exito": False, "mensaje": "No se pudo iniciar sesión"}

    except Exception as e:
        logger.error(f"🚨 Error guardando cuenta: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={
                "exito": False,
                "mensaje": "Error interno del servidor",
                "detalle": str(e)
            }
        )

@app.on_event("startup")
def startup_event():
    global global_clients
    logger.info("🚀 Iniciando carga de sesiones...")

    # kraveaibot siempre primero
    krave_user = os.getenv("IG_USERNAME")
    krave_pass = os.getenv("INSTAGRAM_PASS")
    client = cargar_sesion(krave_user, krave_pass)
    if client:
        global_clients[krave_user] = client
        logger.info(f"✅ kraveaibot listo: @{krave_user}")

    # Las cuentas manuales
    cuentas_path = BASE_PATH / "cuentas_creadas.json"
    if cuentas_path.exists():
        with open(cuentas_path, "r", encoding="utf-8") as f:
            cuentas = json.load(f)
        for c in cuentas:
            client = cargar_sesion(c["usuario"], c["contrasena"])
            if client:
                global_clients[c["usuario"]] = client
                logger.info(f"✅ Sesión restaurada: @{c['usuario']}")

    logger.info("🚩 Todas las cuentas disponibles fueron cargadas correctamente.")


# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://kraveai.netlify.app",
        "http://localhost:3000",
        "https://app.kraveapi.xyz"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

def run_uvicorn():
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_config=None,
        timeout_keep_alive=300
    )

if __name__ == "__main__":
    run_uvicorn()
