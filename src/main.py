# ~/kraveai-backend/src/main.py
import os
import json
import time
import asyncio
from typing import Dict, Any
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from instagrapi import Client
from dotenv import load_dotenv

ENV_PATH = "/home/karmean/kraveai-backend/.env"
if os.path.exists(ENV_PATH):
    load_dotenv(ENV_PATH)

app = FastAPI(title="KraveAI Backend", version="v3.2")

# CORS
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

# Modelos
class ManualAccount(BaseModel):
    username: str
    password: str

class SearchUser(BaseModel):
    username: str

# Almacén de sesiones
SESSIONS: Dict[str, Client] = {}
STORE_FILE = "/home/karmean/kraveai-backend/session_store.json"

def load_store():
    if os.path.exists(STORE_FILE):
        with open(STORE_FILE, "r") as f:
            return json.load(f)
    return {}

def save_store(data: dict):
    with open(STORE_FILE, "w") as f:
        json.dump(data, f, indent=2)

# Login automático al arrancar
@app.on_event("startup")
async def startup_event():
    # Login cuenta principal
    cl = Client()
    cl.set_proxy(os.getenv("PROXY_URL", ""))
    try:
        cl.login(os.getenv("IG_USER"), os.getenv("IG_PASS"))
        SESSIONS["krave"] = cl
        print("✅ Sesión 'krave' iniciada")
    except Exception as e:
        print("❌ No se pudo iniciar sesión 'krave':", e)

    # Login cuentas guardadas
    store = load_store()
    for user, pwd in store.items():
        try:
            c = Client()
            c.set_proxy(os.getenv("PROXY_URL", ""))
            c.login(user, pwd)
            SESSIONS[user] = c
            print(f"✅ Sesión '{user}' restaurada")
        except Exception as e:
            print(f"⚠️ Fallo al restaurar '{user}':", e)

# Health-check
@app.get("/health")
def health():
    krave = SESSIONS.get("krave")
    status = "Activo" if krave else "Inactivo"
    return {"status": "OK", "krave": status}

# Buscar usuario (usa cuenta principal)
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
            "is_business": user.is_business,
            "profile_pic_url": str(user.profile_pic_url),
        }
    except Exception as e:
        raise HTTPException(400, str(e))

# Guardar cuenta manual
@app.post("/add_account")
def add_account(acc: ManualAccount, background: BackgroundTasks):
    if acc.username in SESSIONS:
        raise HTTPException(409, "Cuenta ya existe")
    try:
        cl = Client()
        cl.set_proxy(os.getenv("PROXY_URL", ""))
        cl.login(acc.username, acc.password)
        SESSIONS[acc.username] = cl
        store = load_store()
        store[acc.username] = acc.password
        save_store(store)
        # Keep alive
        background.add_task(keep_alive, acc.username)
        return {"detail": "Cuenta añadida y activa"}
    except Exception as e:
        raise HTTPException(400, str(e))

# Keep-alive en segundo plano
async def keep_alive(username: str):
    while True:
        await asyncio.sleep(300)  # cada 5 min
        cl = SESSIONS.get(username)
        if cl:
            try:
                cl.account_info()
                print(f"🔁 Keep-alive {username}")
            except Exception:
                print(f"💀 Sesión expiró {username}")
                SESSIONS.pop(username, None)
                break

# Listar cuentas activas
@app.get("/accounts")
def list_accounts():
    return {"accounts": list(SESSIONS.keys())}
