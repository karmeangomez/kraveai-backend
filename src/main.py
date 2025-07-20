import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from pathlib import Path
import uvicorn
import logging
from login_utils import login_instagram, is_session_valid

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

# Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(BASE_DIR / "kraveai.log", encoding="utf-8")
    ]
)
logger = logging.getLogger("KraveAI")

app = FastAPI(title="KraveAI Backend", version="v2.5")
cl = None

@app.on_event("startup")
def startup_event():
    global cl
    cl = login_instagram()


@app.get("/health")
def health():
    status = "Fallido"
    if cl and is_session_valid(cl):
        status = f"Activo (@{cl.username})"
    return {
        "status": "OK",
        "versión": "v2.5",
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


def run_uvicorn():
    uvicorn.run(app, host="0.0.0.0", port=8000, timeout_keep_alive=300)


if __name__ == "__main__":
    run_uvicorn()
