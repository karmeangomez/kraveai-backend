import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from src.login_utils import login_instagram
import uvicorn

load_dotenv()
app = FastAPI(title="KraveAI Backend", version="v2.5")

cl = None


@app.on_event("startup")
def startup_event():
    global cl
    cl = login_instagram()


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
        "versión": "v2.5",
        "service": "KraveAI Python",
        "login": status,
        "detalle": "Sesión válida" if "Activo" in status else "Requiere atención"
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
)


def run_uvicorn():
    uvicorn.run(app, host="0.0.0.0", port=8000, timeout_keep_alive=300)


if __name__ == "__main__":
    run_uvicorn()
