import os
import json
from typing import Dict
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from instagrapi import Client

app = FastAPI(title="KraveAI Backend", version="v3.3")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
        with open(STORE_FILE) as f:
            return json.load(f)
    return {}

def save_store(data: dict):
    with open(STORE_FILE, "w") as f:
        json.dump(data, f, indent=2)

# 🚨 NO LOGIN POR AHORA, SOLO PARA QUE /health FUNCIONE
@app.on_event("startup")
async def startup_event():
    print("🚨 Saltando login para revivir /health")

# 2️⃣ Health-check
@app.get("/health")
def health():
    return {"status": "OK", "accounts": list(SESSIONS.keys())}

# 3️⃣ Buscar usuario (NO FUNCIONA SIN LOGIN PERO LO DEJO IGUAL)
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

# 4️⃣ Añadir cuenta manual
@app.post("/add_account")
def add_account(acc: ManualAccount, bg: BackgroundTasks):
    if acc.username in SESSIONS:
        raise HTTPException(409, "Cuenta ya existe")
    try:
        cl = Client()
        cl.login(acc.username, acc.password)
        SESSIONS[acc.username] = cl
        store = load_store()
        store[acc.username] = acc.password
        save_store(store)
        return {"detail": "Cuenta añadida y activa"}
    except Exception as e:
        raise HTTPException(400, str(e))

# 5️⃣ Listar cuentas activas
@app.get("/accounts")
def list_accounts():
    return {"accounts": list(SESSIONS.keys())}
