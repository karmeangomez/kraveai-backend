from fastapi import FastAPI
from .login_utils import login_instagram, restaurar_sesion
import logging
import os
import traceback

# Configuración del logger
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("KraveAI")

app = FastAPI()

# Credenciales desde .env
INSTA_USER = os.getenv("INSTA_USER", "kraveaibot")
INSTA_PASS = os.getenv("INSTA_PASS", "TuContraseñaSegura")

ig_client = None

@app.on_event("startup")
async def startup_event():
    global ig_client
    logger.info("✅ Iniciando backend KraveAI...")

    try:
        ig_client = restaurar_sesion(INSTA_USER)
        if not ig_client:
            logger.info(f"🔐 No se encontró sesión activa. Iniciando login para {INSTA_USER}...")
            ig_client = login_instagram(INSTA_USER, INSTA_PASS)

        if ig_client:
            logger.info("✅ Sesión iniciada correctamente.")
        else:
            logger.critical("❌ No se pudo iniciar sesión en Instagram.")

    except Exception as e:
        logger.critical(f"🔥 Error al iniciar backend: {e}")
        logger.error(traceback.format_exc())

@app.get("/health")
async def health_check():
    status = "active" if ig_client else "inactive"
    return {"status": "ok", "instagram": status}

@app.get("/")
async def root():
    return {
        "message": "Bienvenido a KraveAI Backend",
        "status": "operativo" if ig_client else "con problemas"
    }
