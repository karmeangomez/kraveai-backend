import os
import logging
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from instagrapi import Client
from dotenv import load_dotenv
import uvicorn

# Cargar .env
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(env_path)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s]: %(message)s")
logger = logging.getLogger("KraveAI")

app = FastAPI(title="KraveAI Backend", version="2.3")
cl = None


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


@app.on_event("startup")
def startup_event():
    global cl
    cl = Client()
    try:
        proxy = {
            "http": f"http://{os.getenv('WEBSHARE_RESIDENTIAL_USER')}:{os.getenv('WEBSHARE_RESIDENTIAL_PASS')}@p.webshare.io:80",
            "https": f"http://{os.getenv('WEBSHARE_RESIDENTIAL_USER')}:{os.getenv('WEBSHARE_RESIDENTIAL_PASS')}@p.webshare.io:80"
        }
        cl.set_proxy(proxy)

        IG_USERNAME = os.getenv("IG_USERNAME")
        IG_PASSWORD = os.getenv("INSTAGRAM_PASS")
        if IG_USERNAME and IG_PASSWORD:
            cl.login(IG_USERNAME, IG_PASSWORD)
            logger.info(f"KraveAI conectado como @{cl.username}")
    except Exception as e:
        logger.warning(f"No se pudo iniciar sesión en cuenta principal: {e}")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://kraveai.netlify.app", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def run_uvicorn():
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)


if __name__ == "__main__":
    run_uvicorn()
