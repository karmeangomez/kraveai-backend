import os
import time
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .login_utils import login_instagram  # Importación relativa
import uvicorn
from dotenv import load_dotenv

# 1. Carga segura del .env
ENV_PATH = "/home/karmean/kraveai-backend/.env"
if os.path.exists(ENV_PATH):
    load_dotenv(ENV_PATH, override=True)
    print(f"✅ .env cargado desde {ENV_PATH}")
else:
    print(f"❌ ERROR CRÍTICO: .env no encontrado en {ENV_PATH}")
    raise RuntimeError("Archivo .env no encontrado")

app = FastAPI(title="KraveAI Backend", version="v3.0")

# 2. Variables globales de sesión
cl = None
LAST_LOGIN_ATTEMPT = 0

@app.on_event("startup")
def initialize_session():
    global cl, LAST_LOGIN_ATTEMPT
    print("\n" + "="*50)
    print("🔥 INICIANDO BACKEND KRAVEAI - SISTEMA AUTO-REPARABLE")
    print("="*50)

    cl = login_instagram()
    LAST_LOGIN_ATTEMPT = time.time()

    if not cl:
        print("⛔ ALERTA: No se pudo establecer sesión inicial")

# 3. Health-check con auto-reparación
@app.get("/health")
def health_check():
    global cl, LAST_LOGIN_ATTEMPT

    status = "Fallido"
    detalle = "Requiere atención"
    username = "N/A"

    # Re-intento cada 5 min si está caído
    if not cl and (time.time() - LAST_LOGIN_ATTEMPT > 300):
        print("🔄 Intentando reconexión automática...")
        cl = login_instagram()
        LAST_LOGIN_ATTEMPT = time.time()

    if cl:
        try:
            user_info = cl.user_info(cl.user_id)
            status = f"Activo (@{user_info.username})"
            detalle = "Sesión válida"
            username = user_info.username
        except Exception as e:
            status = "Fallido"
            detalle = f"Error: {str(e)[:100]}"
            print("⚠️ Sesión expirada. Iniciando autoreparación...")
            cl = login_instagram()
            LAST_LOGIN_ATTEMPT = time.time()
            if cl:
                status = f"Recuperado (@{cl.username})"
                detalle = "Sesión restablecida"

    return {
        "status": "OK",
        "versión": app.version,
        "service": "KraveAI Python",
        "login": status,
        "detalle": detalle,
        "usuario": username,
        "timestamp": int(time.time())
    }

# 4. CORS
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
    expose_headers=["X-Status-Message"]
)

# 5. Arranque del servidor
def run_server():
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        timeout_keep_alive=300,
        log_level="info",
        access_log=True
    )

if __name__ == "__main__":
    run_server()
