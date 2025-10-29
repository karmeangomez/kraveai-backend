# main.py
# Backend para KraveAI (FastAPI)
# Endpoints: /health, /avatar, /buscar-usuario, /refresh-clients, /purge-cache, /youtube/ordenar-vistas

from fastapi import FastAPI, HTTPException, Query, Header, BackgroundTasks
from fastapi.responses import RedirectResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel, Field
from typing import Dict, List, Optional
import time, os, threading

APP_NAME = "KraveAI API"
VERSION = "1.0.4"
CACHE_TTL_SECONDS = int(os.getenv("KRAVE_CACHE_TTL", "900"))
PROFILE_MAX_AGE = int(os.getenv("KRAVE_PROFILE_MAX_AGE", "60"))
AVATAR_MAX_AGE = int(os.getenv("KRAVE_AVATAR_MAX_AGE", "86400"))
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN")

app = FastAPI(title=APP_NAME, version=VERSION)

allowed_origins = os.getenv("ALLOWED_ORIGINS", "*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in allowed_origins.split(",")] if allowed_origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=512)

# ===== Modelos =====
class UserInfo(BaseModel):
    username: str
    full_name: Optional[str] = None
    follower_count: Optional[int] = None
    following_count: Optional[int] = None
    media_count: Optional[int] = None
    biography: Optional[str] = None
    is_verified: Optional[bool] = None
    profile_pic_url: Optional[str] = None

class RefreshReq(BaseModel):
    users: List[str] = []

class YouTubeOrder(BaseModel):
    video_url: str
    cantidad: int
    username: Optional[str] = ""

class YouTubeOrderResponse(BaseModel):
    success: bool
    message: str
    order_id: str

class RefreshResp(BaseModel):
    usuarios: Dict[str, UserInfo] = {}

# ===== Cache simple =====
class TTLCache:
    def __init__(self, ttl_seconds: int):
        self.ttl = ttl_seconds
        self.store: Dict[str, Dict] = {}
    def get(self, key: str):
        row = self.store.get(key)
        if not row: return None
        if (time.time() - row["t"]) > self.ttl:
            self.store.pop(key, None); return None
        return row["data"]
    def set(self, key: str, value):
        self.store[key] = {"t": time.time(), "data": value}
    def clear(self): self.store.clear()

profile_cache = TTLCache(CACHE_TTL_SECONDS)

def json_cached(payload: dict, max_age: int = 0) -> JSONResponse:
    resp = JSONResponse(payload)
    resp.headers["Cache-Control"] = f"public, max-age={max_age}" if max_age > 0 else "no-store"
    return resp

# ===== YouTube Bot Integration =====
def ejecutar_bot_youtube(video_url: str, cantidad_vistas: int, username: str = ""):
    """Ejecuta el bot de YouTube en segundo plano"""
    try:
        print(f"🎯 Iniciando bot YouTube: {cantidad_vistas} vistas para {video_url}")
        
        # Simulación - reemplaza con tu bot real
        print(f"✅ Simulando {cantidad_vistas} vistas para: {video_url}")
        print("📦 Usando proxies de: proxies/proxies.json")
        
        # Aquí integrarías tu youtube_bot.py real
        for i in range(min(5, cantidad_vistas)):  # Simular primeras 5 vistas
            print(f"✅ Vista {i+1} exitosa | Proxy: 192.168.1.{i+1}:8080")
            time.sleep(0.5)
            
        print(f"📊 COMPLETADO | Vistas simuladas: {cantidad_vistas}")
        return {"status": "completed", "vistas": cantidad_vistas}
        
    except Exception as e:
        print(f"❌ Error en bot YouTube: {e}")
        return {"status": "error", "error": str(e)}

# ===== Seed =====
SEED: Dict[str, UserInfo] = {
    "cadillacf1": UserInfo(username="cadillacf1", full_name="Cadillac Formula 1 Team",
                           follower_count=1200000, following_count=200, media_count=320,
                           biography="Equipo F1 · Cadillac Racing", is_verified=True),
    "manuelturizo": UserInfo(username="manuelturizo", full_name="Manuel Turizo",
                             follower_count=18300000, following_count=450, media_count=1500,
                             biography="Cantante", is_verified=True),
    "pesopluma": UserInfo(username="pesopluma", full_name="Peso Pluma",
                          follower_count=17000000, following_count=210, media_count=900,
                          biography="Double P", is_verified=True),
}

def seed_or_stub(username: str) -> UserInfo:
    key = username.lower().strip()
    if key in SEED: return SEED[key]
    base = abs(hash(key)) % 1_000_000
    return UserInfo(
        username=key, full_name=key,
        follower_count=20000 + (base % 50000),
        following_count=100 + (base % 900),
        media_count=50 + (base % 1500),
        biography=f"Perfil de {key}",
        is_verified=False,
    )

def with_avatar(u: UserInfo) -> dict:
    d = u.dict()
    d["profile_pic_url"] = f"/avatar?username={u.username}"
    return d

# ===== Rutas EXISTENTES =====
@app.get("/health")
def health(): return {"status": "ok", "name": APP_NAME, "version": VERSION}

@app.get("/avatar")
def avatar(username: str = Query(...)):
    u = username.strip().lstrip("@")
    resp = RedirectResponse(url=f"https://unavatar.io/instagram/{u}", status_code=302)
    resp.headers["Cache-Control"] = f"public, max-age={AVATAR_MAX_AGE}"
    return resp

@app.get("/buscar-usuario")
def buscar_usuario(username: str = Query(...)):
    u = username.strip().lstrip("@").lower()
    cached = profile_cache.get(f"user:{u}")
    if cached: return json_cached({"usuario": cached}, PROFILE_MAX_AGE)
    info = seed_or_stub(u)
    payload = with_avatar(info)
    profile_cache.set(f"user:{u}", payload)
    return json_cached({"usuario": payload}, PROFILE_MAX_AGE)

@app.post("/refresh-clients", response_model=RefreshResp)
def refresh_clients(req: RefreshReq):
    if not req.users: raise HTTPException(status_code=400, detail="Falta lista de usuarios")
    result: Dict[str, UserInfo] = {}
    for raw_u in req.users:
        u = (raw_u or "").strip().lstrip("@").lower()
        if not u: continue
        cached = profile_cache.get(f"user:{u}")
        if cached: result[u] = UserInfo(**cached); continue
        info = seed_or_stub(u)
        payload = with_avatar(info)
        profile_cache.set(f"user:{u}", payload)
        result[u] = UserInfo(**payload)
    resp = JSONResponse({"usuarios": {k: v.dict() for k,v in result.items()}})
    resp.headers["Cache-Control"] = f"public, max-age={PROFILE_MAX_AGE}"
    return resp

@app.post("/purge-cache")
def purge_cache(x_admin_token: Optional[str] = Header(default=None)):
    if ADMIN_TOKEN and x_admin_token != ADMIN_TOKEN:
        raise HTTPException(status_code=403, detail="Forbidden")
    profile_cache.clear()
    return {"ok": True, "purged": True}

# ===== NUEVA RUTA YOUTUBE =====
@app.post("/youtube/ordenar-vistas", response_model=YouTubeOrderResponse)
async def ordenar_vistas_youtube(order: YouTubeOrder, background_tasks: BackgroundTasks):
    """NUEVO: Endpoint para ordenar vistas de YouTube"""
    try:
        video_url = order.video_url.strip()
        cantidad = order.cantidad
        
        if not video_url or not cantidad:
            raise HTTPException(status_code=400, detail="URL y cantidad requeridos")
        
        if not any(domain in video_url for domain in ['youtu.be', 'youtube.com']):
            raise HTTPException(status_code=400, detail="URL de YouTube no válida")
        
        if cantidad > 500:
            raise HTTPException(status_code=400, detail="Máximo 500 vistas por orden")
        if cantidad < 10:
            raise HTTPException(status_code=400, detail="Mínimo 10 vistas por orden")
        
        # Ejecutar en segundo plano
        background_tasks.add_task(ejecutar_bot_youtube, video_url, cantidad, order.username)
        
        return YouTubeOrderResponse(
            success=True,
            message=f"✅ Orden recibida: {cantidad} vistas para YouTube",
            order_id=f"yt_{int(time.time())}"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")

@app.get("/")
def root(): return {"ok": True, "service": APP_NAME, "docs": "/docs"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
