import os
import logging
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from instagrapi import Client
from fastapi.responses import JSONResponse

# Cargar .env
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(env_path)

BASE_PATH = Path(__file__).resolve().parent
SESIONES_DIR = BASE_PATH / "sesiones"
SESIONES_DIR.mkdir(exist_ok=True, parents=True)

USERNAME = os.getenv("IG_USERNAME")
SESSION_FILE = SESIONES_DIR / f"ig_session_{USERNAME}.json"

# Configuración Logging
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


def load_client_session():
    cl = Client()
    if SESSION_FILE.exists():
        try:
            cl.load_settings(str(SESSION_FILE))
            cl.get_timeline_feed()
            logger.info(f"✅ Sesión restaurada para @{cl.username}")
            return cl
        except Exception as e:
            logger.warning(f"⚠️ Sesión inválida: {e}")
    return None


cl = None


@app.on_event("startup")
def startup_event():
    global cl
    cl = load_client_session()
    if not cl:
        logger.error("🚨 No se pudo restaurar la sesión. Verifica manualmente en /sesiones/")
    else:
        logger.info(f"✅ Sesión lista como @{cl.username}")


@app.get("/health")
def health():
    status = "Fallido"
    if cl:
        try:
            cl.get_timeline_feed()
            status = f"Activo (@{cl.username})"
        except Exception:
            status = "Fallido"

    return {
        "status": "OK",
        "versión": "v2.4",
        "service": "KraveAI Python",
        "login": status,
        "detalle": "Sesión válida" if status.startswith("Activo") else "Requiere atención"
    }


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


# Run para Uvicorn (si quieres usarlo local directo)
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, timeout_keep_alive=300)
