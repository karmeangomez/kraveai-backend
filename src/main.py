import os
import json
import logging
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from pydantic import BaseModel
from login_utils import login_instagram

# 📂 Rutas
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(env_path)

BASE_PATH = Path(__file__).resolve().parent.parent
SESIONES_DIR = BASE_PATH / "sesiones"
SESIONES_DIR.mkdir(exist_ok=True, parents=True)
CUENTAS_PATH = BASE_PATH / "cuentas_creadas.json"

# 🔥 Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(BASE_PATH / "kraveai.log", encoding="utf-8")
    ]
)
logger = logging.getLogger("KraveAI")

# 🚀 FastAPI App
app = FastAPI(title="KraveAI Backend", version="v2.4")

# 🔑 Iniciar cuenta principal IG
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
    global cl
    cl = login_instagram()


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
