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

# Cargar .env
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(env_path)
logger = logging.getLogger("KraveAI")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("kraveai.log")
    ]
)
logger.info("✅ Variables de entorno cargadas")

BASE_PATH = Path(__file__).resolve().parent.parent
SESIONES_DIR = BASE_PATH / "sesiones"
SESIONES_DIR.mkdir(exist_ok=True, parents=True)

app = FastAPI(title="KraveAI Backend", version="2.4")
cl = None


def verificar_sesion_activa(client):
    try:
        if client and client.user_id:
            client.get_timeline_feed()
            return True
        return False
    except Exception:
        return False


@app.get("/health")
def health():
    try:
        status = "Fallido"
        if cl and verificar_sesion_activa(cl):
            status = f"Activo (@{cl.username})"

        return {
            "status": "OK",
            "versión": "v2.4 - estable",
            "service": "KraveAI Python",
            "login": status,
            "detalle": "Sistema operativo" if status.startswith("Activo") else "Requiere atención"
        }
    except Exception as e:
        logger.error(f"Error crítico en /health: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={
                "status": "ERROR",
                "error": str(e)
            }
        )


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

        logger.info(f"➕ Nueva cuenta guardada: @{datos.usuario}")
        return {"exito": True, "mensaje": "Cuenta registrada exitosamente"}

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
    global cl
    cl = Client()

    IG_USERNAME = os.getenv("IG_USERNAME")
    IG_PASSWORD = os.getenv("INSTAGRAM_PASS")

    if not IG_USERNAME or not IG_PASSWORD:
        logger.error("❌ Credenciales principales faltan en .env")
        return

    logger.info(f"🔑 Intentando login como: {IG_USERNAME}")

    settings_file = BASE_PATH / f"ig_session_{IG_USERNAME}.json"
    try:
        proxy_user = os.getenv('WEBSHARE_RESIDENTIAL_USER')
        proxy_pass = os.getenv('WEBSHARE_RESIDENTIAL_PASS')

        if proxy_user and proxy_pass:
            proxy_str = f"http://{proxy_user}:{proxy_pass}@p.webshare.io:80"
            logger.info(f"🔌 Configurando proxy: {proxy_user[:4]}****@{proxy_pass[:2]}****")
            cl.set_proxy(proxy_str)

        if settings_file.exists():
            cl.load_settings(str(settings_file))
            cl.login(IG_USERNAME, IG_PASSWORD)
        else:
            cl.login(IG_USERNAME, IG_PASSWORD)
            cl.dump_settings(str(settings_file))

        if verificar_sesion_activa(cl):
            logger.info(f"✅ Login exitoso como @{cl.username}")
        else:
            logger.warning("⚠️ Sesión iniciada pero no válida")

    except Exception as global_error:
        logger.critical(f"💥 Error global en startup: {str(global_error)}")


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
