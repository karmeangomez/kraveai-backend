from fastapi import FastAPI, HTTPException
from .login_utils import login_instagram, restaurar_sesion
import logging
import os

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("KraveAI")

app = FastAPI()

INSTA_USER = os.getenv("INSTA_USER", "kraveaibot")
INSTA_PASS = os.getenv("INSTA_PASS", "TuContraseñaSegura")

ig_client = None

@app.on_event("startup")
async def startup_event():
    global ig_client
    logger.info("✅ Aplicación inicializada correctamente")
    logger.info("🚀 Iniciando servicio de Instagram...")

    ig_client = restaurar_sesion(INSTA_USER)
    if not ig_client:
        logger.info(f"🔑 Iniciando nueva sesión para {INSTA_USER}")
        ig_client = login_instagram(INSTA_USER, INSTA_PASS)

    if not ig_client:
        logger.critical("❌ No se pudo iniciar sesión en Instagram")

@app.get("/health")
async def health_check():
    return {"status": "ok", "instagram": "active" if ig_client else "inactive"}

@app.get("/")
async def root():
    return {
        "message": "Bienvenido a KraveAI Backend",
        "status": "operativo" if ig_client else "con problemas"
    }
