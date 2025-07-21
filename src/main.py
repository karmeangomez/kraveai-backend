# 📁 /home/karmean/kraveai-backend/src/main.py
import os
import time
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .login_utils import login_instagram
import uvicorn
from dotenv import load_dotenv

# 1️⃣ Carga segura del .env
ENV_PATH = "/home/karmean/kraveai-backend/.env"
if os.path.exists(ENV_PATH):
    load_dotenv(ENV_PATH, override=True)
    print(f"✅ .env cargado desde {ENV_PATH}")
else:
    raise RuntimeError("Archivo .env no encontrado")

app = FastAPI(title="KraveAI Backend", version="v3.1")

# 2️⃣ Variables globales de sesión
cl = None
LAST_LOGIN_ATTEMPT = 0

@app.on_event("startup")
def initialize_session():
    global cl, LAST_LOGIN_ATTEMPT
    print("\n" + "=" * 50)
    print("🔥 INICIANDO BACKEND KRAVEAI")
    print("=" * 50)
    cl = login_instagram()
    LAST_LOGIN_ATTEMPT = time.time()
    if not cl:
        print("⚠️ No se pudo establecer sesión inicial")

# 3️⃣ Health-check robusto: siempre reintenta si cl es None
@app.get("/health")
def health_check():
    global cl, LAST_LOGIN_ATTEMPT

    status = "Fallido"
    detalle = "Requiere atención"
    username = "N/A"

    if cl is None:
        print("🔄 Forzando login porque cl está vacío...")
        cl = login_instagram()
        LAST_LOGIN_ATTEMPT = time.time()

    if cl:
        try:
            username = cl.account_info().username
            status = f"Activo (@{username})"
            detalle = "Sesión válida"
        except Exception as e:
            print(f"⚠️ Sesión expirada: {str(e)}")
            cl = login_instagram()
            LAST_LOGIN_ATTEMPT = time.time()
            if cl:
                username = cl.account_info().username
                status = f"Recuperado (@{username})"
                detalle = "Sesión restablecida"

    return {
        "status": "OK",
        "versión": app.version,
        "service": "KraveAI Python",
        "login": status,
        "detalle": detalle,
        "usuario": username,
        "timestamp": int(time.time()),
    }

# 4️⃣ CORS para tu frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://kraveai.netlify.app",
        "http://localhost:3000",
        "https://app.kraveapi.xyz",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Status-Message"],
)

# 5️⃣ Arranque del servidor Uvicorn
def run_server():
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        timeout_keep_alive=300,
        log_level="info",
        access_log=True,
    )

if __name__ == "__main__":
    run_server()
