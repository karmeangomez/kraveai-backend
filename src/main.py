# 📁 /home/karmean/kraveai-backend/src/main.py
import os
import json
import time
import threading
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from login_utils import login_instagram
import uvicorn
from dotenv import load_dotenv

# 1️⃣ Carga segura del .env
ENV_PATH = "/home/karmean/kraveai-backend/.env"
if os.path.exists(ENV_PATH):
    load_dotenv(ENV_PATH, override=True)
else:
    raise RuntimeError("Archivo .env no encontrado")

app = FastAPI(title="KraveAI Backend", version="v3.2")

# 2️⃣ Archivo donde se persisten las cuentas manuales
CUENTAS_FILE = Path("/home/karmean/kraveai-backend/sesiones/cuentas.json")
CUENTAS_FILE.parent.mkdir(parents=True, exist_ok=True)

def cargar_cuentas() -> list:
    try:
        return json.loads(CUENTAS_FILE.read_text()) if CUENTAS_FILE.exists() else []
    except Exception:
        return []

def guardar_cuentas(cuentas: list):
    CUENTAS_FILE.write_text(json.dumps(cuentas, indent=2))

# 3️⃣ Estado global: sesión activa (siempre la misma)
cl = None
LAST_LOGIN_ATTEMPT = 0

def refresh_session():
    """Mantiene la sesión viva cada 5 min"""
    global cl, LAST_LOGIN_ATTEMPT
    while True:
        time.sleep(300)
        if cl:
            try:
                cl.get_timeline_feed()
            except Exception:
                # Re-login automático
                cl = login_instagram()
                LAST_LOGIN_ATTEMPT = time.time()

threading.Thread(target=refresh_session, daemon=True).start()

# 4️⃣ Startup
@app.on_event("startup")
def initialize_session():
    global cl, LAST_LOGIN_ATTEMPT
    print("\n" + "=" * 50)
    print("🔥 INICIANDO BACKEND KRAVEAI")
    print("=" * 50)
    cl = login_instagram()
    LAST_LOGIN_ATTEMPT = time.time()

# 5️⃣ Health-check
@app.get("/health")
def health_check():
    global cl
    if cl is None:
        cl = login_instagram()
    if cl:
        try:
            username = cl.account_info().username
            return {
                "status": "OK",
                "versión": app.version,
                "service": "KraveAI Python",
                "login": f"Activo (@{username})",
                "detalle": "Sesión viva",
                "usuario": username,
                "timestamp": int(time.time()),
            }
        except Exception:
            cl = login_instagram()
    return {
        "status": "OK",
        "versión": app.version,
        "service": "KraveAI Python",
        "login": "Fallido",
        "detalle": "Requiere atención",
        "usuario": None,
        "timestamp": int(time.time()),
    }

# 6️⃣ NUEVOS ENDPOINTS ---------------------------------
from pydantic import BaseModel

class Credenciales(BaseModel):
    usuario: str
    contrasena: str

@app.post("/iniciar-sesion")
def iniciar_sesion(creds: Credenciales):
    global cl
    try:
        cl = login_instagram()
        if cl and cl.user_id:
            return {"exito": True, "usuario": cl.account_info().username}
        return {"exito": False, "mensaje": "Credenciales incorrectas"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/estado-sesion")
def estado_sesion():
    if cl and cl.user_id:
        return {"status": "activo", "usuario": cl.account_info().username}
    return {"status": "inactivo"}


@app.post("/guardar-cuenta")
def guardar_cuenta(cuenta: Credenciales):
    cuentas = cargar_cuentas()
    # Evitar duplicados
    if any(c["usuario"] == cuenta.usuario for c in cuentas):
        return {"exito": False, "mensaje": "La cuenta ya existe"}
    cuentas.append({"usuario": cuenta.usuario, "contrasena": cuenta.contrasena})
    guardar_cuentas(cuentas)
    return {"exito": True, "mensaje": "Cuenta guardada"}


@app.get("/cuentas-guardadas")
def cuentas_guardadas():
    return cargar_cuentas()


@app.get("/buscar-usuario")
def buscar_usuario(username: str):
    if not cl:
        raise HTTPException(status_code=400, detail="No hay sesión activa")
    try:
        user = cl.user_info_by_username(username)
        return {
            "username": user.username,
            "nombre": user.full_name,
            "foto": user.profile_pic_url,
            "seguidores": user.follower_count,
            "publicaciones": user.media_count,
            "verificado": user.is_verified,
            "privado": user.is_private,
            "negocio": user.is_business,
            "biografia": user.biography,
        }
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

# 7️⃣ CORS
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
)

# 8️⃣ Arranque local (opcional)
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
