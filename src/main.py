import os
import json
from pathlib import Path
from typing import Dict
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from instagrapi import Client
from src.login_utils import load_proxies, get_random_proxy
from dotenv import load_dotenv

# Cargar .env
ENV_PATH = Path("/home/karmean/kraveai-backend/.env")
if ENV_PATH.exists():
    load_dotenv(dotenv_path=ENV_PATH, override=True)
    print(f"✅ .env cargado desde {ENV_PATH}")

# Variables
SESSION_DIR = Path("/home/karmean/kraveai-backend/sesiones")
STORE_FILE = Path("/home/karmean/kraveai-backend/session_store.json")
SESSION_DIR.mkdir(parents=True, exist_ok=True)

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

# Models
class ManualAccount(BaseModel):
    username: str
    password: str

class SearchUser(BaseModel):
    username: str

# Sessions
SESSIONS: Dict[str, Client] = {}

# Cargar proxies
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
            cl.user_info(cl.user_id)
            print(f"✅ Sesión restaurada @{username}")
            return cl
        except Exception:
            session_file.unlink(missing_ok=True)

    cl.login(username, password)
    cl.dump_settings(session_file)
    print(f"🎉 Login nuevo @{username}")
    return cl


@app.on_event("startup")
async def startup_event():
    store = load_store()

    # kraveaibot obligatorio activo para búsqueda
    if USERNAME and PASSWORD:
        SESSIONS["krave"] = iniciar_sesion(USERNAME, PASSWORD)

    for user, pwd in store.items():
        if user != USERNAME:
            try:
                SESSIONS[user] = iniciar_sesion(user, pwd)
            except Exception as e:
                print(f"⚠️ Error cargando {user}: {e}")


@app.get("/health")
def health():
    return {"status": "OK", "accounts": list(SESSIONS.keys())}


@app.post("/search")
def search_user(data: SearchUser):
    cl = SESSIONS.get("krave")
    if not cl:
        raise HTTPException(503, "Sesión 'krave' no disponible")
    try:
        user = cl.user_info_by_username(data.username.strip("@"))
        return {
            "username": user.username,
            "full_name": user.full_name,
            "followers": user.follower_count,
            "following": user.following_count,
            "posts": user.media_count,
            "biography": user.biography,
            "is_private": user.is_private,
            "is_verified": user.is_verified,
            "profile_pic_url": str(user.profile_pic_url),
        }
    except Exception as e:
        raise HTTPException(400, str(e))


@app.post("/guardar-cuenta")
def guardar_cuenta(acc: ManualAccount):
    if acc.username in SESSIONS:
        raise HTTPException(409, "Cuenta ya existe")
    try:
        cl = iniciar_sesion(acc.username, acc.password)
        SESSIONS[acc.username] = cl
        store = load_store()
        store[acc.username] = acc.password
        save_store(store)
        return {"exito": True, "mensaje": "Cuenta añadida y activa"}
    except Exception as e:
        raise HTTPException(400, f"Error: {str(e)}")


@app.get("/accounts")
def list_accounts():
    return {"accounts": list(SESSIONS.keys())}


# 🔥 NECESARIO PARA CORRER uvicorn DESDE PYTHON
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.main:app", host="127.0.0.1", port=8000, reload=False)
