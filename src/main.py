import os
import json
from pathlib import Path
from typing import Dict
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from instagrapi import Client
from dotenv import load_dotenv
from src.login_utils import load_proxies, get_random_proxy

# Cargar .env
ENV_PATH = Path("/home/karmean/kraveai-backend/.env")
if ENV_PATH.exists():
    load_dotenv(dotenv_path=ENV_PATH, override=True)

# Configuración de rutas
SESSION_DIR = Path("sesiones")
SESSION_DIR.mkdir(parents=True, exist_ok=True)
STORE_FILE = Path("cuentas_creadas.json")

USERNAME = os.getenv("IG_USERNAME")
PASSWORD = os.getenv("INSTAGRAM_PASS")

# FastAPI
app = FastAPI(title="KraveAI Backend", version="v3.3")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ManualAccount(BaseModel):
    usuario: str
    contrasena: str

class SearchUser(BaseModel):
    username: str

SESSIONS: Dict[str, Client] = {}
proxies = load_proxies()

def save_store(data: dict):
    with open(STORE_FILE, "w") as f:
        json.dump(data, f, indent=2)

def load_store():
    if STORE_FILE.exists():
        with open(STORE_FILE) as f:
            return json.load(f)
    return {}

def session_file_path(username):
    return SESSION_DIR / f"ig_session_{username}.json"

def iniciar_sesion(username, password):
    cl = Client()
    cl.delay_range = [3, 7]
    proxy = get_random_proxy(proxies)
    if proxy:
        cl.set_proxy(proxy)

    session_file = session_file_path(username)

    if session_file.exists():
        try:
            cl.load_settings(session_file)
            cl.get_timeline_feed()
            print(f"✅ Sesión restaurada @{username}")
            return cl
        except Exception:
            session_file.unlink(missing_ok=True)

    cl.login(username, password)
    cl.dump_settings(session_file)
    print(f"🎉 Login nuevo @{username}")
    return cl

@app.on_event("startup")
def startup_event():
    if USERNAME and PASSWORD:
        try:
            SESSIONS["krave"] = iniciar_sesion(USERNAME, PASSWORD)
        except Exception as e:
            print(f"⚠️ Error iniciando sesión principal: {e}")

    for user, pwd in load_store().items():
        if user != USERNAME:
            try:
                SESSIONS[user] = iniciar_sesion(user, pwd)
            except Exception as e:
                print(f"⚠️ Error cargando {user}: {e}")

@app.get("/health")
def health():
    return {"status": "OK", "accounts": list(SESSIONS.keys())}

@app.get("/estado-sesion")
def estado_sesion():
    return {"status": "activo" if "krave" in SESSIONS else "inactivo"}

@app.post("/iniciar-sesion")
def iniciar_sesion_manual(data: ManualAccount):
    try:
        cl = iniciar_sesion(data.usuario, data.contrasena)
        SESSIONS[data.usuario] = cl
        return {"exito": True, "usuario": data.usuario}
    except Exception as e:
        return {"exito": False, "mensaje": str(e)}

@app.get("/cerrar-sesion")
def cerrar_sesion():
    if "krave" in SESSIONS:
        del SESSIONS["krave"]
        f = session_file_path(USERNAME)
        if f.exists():
            f.unlink()
        return {"exito": True}
    return {"exito": False, "mensaje": "Sesión no activa"}

@app.post("/guardar-cuenta")
def guardar_cuenta(data: ManualAccount):
    try:
        cl = iniciar_sesion(data.usuario, data.contrasena)
        SESSIONS[data.usuario] = cl
        store = load_store()
        store[data.usuario] = data.contrasena
        save_store(store)
        return {"exito": True}
    except Exception as e:
        return {"exito": False, "mensaje": str(e)}

@app.post("/buscar-usuario")
def buscar_usuario(data: SearchUser):
    cl = SESSIONS.get("krave")
    if not cl:
        raise HTTPException(503, "Sesión de búsqueda no activa")
    try:
        user = cl.user_info_by_username(data.username.strip("@"))
        return {
            "username": user.username,
            "nombre": user.full_name,
            "foto": user.profile_pic_url,
            "publicaciones": user.media_count,
            "seguidores": user.follower_count,
            "seguidos": user.following_count,
            "biografia": user.biography,
            "privado": user.is_private,
            "verificado": user.is_verified,
        }
    except Exception as e:
        raise HTTPException(400, str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.main:app", host="127.0.0.1", port=8000)
