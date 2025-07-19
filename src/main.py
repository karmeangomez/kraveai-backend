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


# 📂 Cargar variables .env
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(env_path)

BASE_PATH = Path(__file__).resolve().parent.parent
SESIONES_DIR = BASE_PATH / "sesiones"
SESIONES_DIR.mkdir(exist_ok=True, parents=True)
CUENTAS_PATH = BASE_PATH / "cuentas_creadas.json"

# 🔥 Logging mejorado
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(BASE_PATH / "kraveai.log", encoding="utf-8")
    ]
)
logger = logging.getLogger("KraveAI")

app = FastAPI(title="KraveAI Backend", version="v2.4")


def load_client_session(username):
    session_file = SESIONES_DIR / f"ig_session_{username}.json"
    cl = Client()
    if session_file.exists():
        try:
            cl.load_settings(session_file)
            cl.get_timeline_feed()
            logger.info(f"✅ Sesión restaurada para {username}")
            return cl
        except Exception as e:
            logger.warning(f"⚠️ Falló sesión guardada para {username}: {e}")
    return None


def save_client_session(cl, username):
    session_file = SESIONES_DIR / f"ig_session_{username}.json"
    cl.dump_settings(session_file)
    logger.info(f"💾 Sesión guardada para {username}")


# 🔑 Cuenta principal
cl = None


def iniciar_cuenta_principal():
    global cl
    username = os.getenv("IG_USERNAME")
    password = os.getenv("INSTAGRAM_PASS")

    if not username or not password:
        logger.error("❌ Falta IG_USERNAME o INSTAGRAM_PASS en .env")
        return

    cl_restored = load_client_session(username)
    if cl_restored:
        cl = cl_restored
        return

    try:
        cl = Client()
        logger.info(f"➡️ Iniciando sesión para {username} sin proxy")
        cl.login(username, password)
        save_client_session(cl, username)
        logger.info(f"✅ Login exitoso @{cl.username}")
    except Exception as e:
        logger.error(f"🚫 Error al iniciar sesión para {username}: {e}")
        cl = None


def verificar_sesion_activa(client):
    try:
        if client and client.user_id:
            client.get_timeline_feed()
            return True
        return False
    except Exception:
        return False


@app.on_event("startup")
def startup_event():
    iniciar_cuenta_principal()


@app.get("/health")
def health():
    status = "Fallido"
    if cl and verificar_sesion_activa(cl):
        status = f"Activo (@{cl.username})"
    return {
        "status": "OK",
        "versión": "v2.4",
        "service": "KraveAI Python",
        "login": status,
        "detalle": "Sesión válida" if status.startswith("Activo") else "Requiere atención"
    }


class GuardarCuentaRequest(BaseModel):
    usuario: str
    contrasena: str


@app.post("/guardar-cuenta")
def guardar_cuenta(datos: GuardarCuentaRequest):
    try:
        cuentas = []
        if CUENTAS_PATH.exists():
            with open(CUENTAS_PATH, "r", encoding="utf-8") as f:
                cuentas = json.load(f)

        if any(c["usuario"] == datos.usuario for c in cuentas):
            return JSONResponse(
                status_code=400,
                content={"exito": False, "mensaje": "Cuenta ya registrada"}
            )

        cuentas.append({"usuario": datos.usuario, "contrasena": datos.contrasena})
        with open(CUENTAS_PATH, "w", encoding="utf-8") as f:
            json.dump(cuentas, f, ensure_ascii=False, indent=4)

        # Guarda la sesión de la nueva cuenta manualmente al guardarla
        cl_tmp = Client()
        try:
            cl_tmp.login(datos.usuario, datos.contrasena)
            save_client_session(cl_tmp, datos.usuario)
            logger.info(f"✅ Sesión guardada para nueva cuenta @{datos.usuario}")
        except Exception as e:
            logger.warning(f"⚠️ No se pudo iniciar sesión @{datos.usuario}: {e}")

        logger.info(f"➕ Nueva cuenta guardada: @{datos.usuario}")
        return {"exito": True, "mensaje": "Cuenta guardada exitosamente"}

    except Exception as e:
        logger.error(f"🚨 Error guardando cuenta: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"exito": False, "mensaje": "Error interno", "detalle": str(e)}
        )


# 🌐 CORS para tu frontend
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
    uvicorn.run(app, host="0.0.0.0", port=8000, timeout_keep_alive=300)


if __name__ == "__main__":
    run_uvicorn()
