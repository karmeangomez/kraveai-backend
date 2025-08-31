# main.py
# Backend para KraveAI (FastAPI)
# Endpoints: /health, /avatar, /buscar-usuario, /refresh-clients, /purge-cache
# Modo demo con caché en memoria y datos semilla. Seguro para prod detrás de un proxy.

from fastapi import FastAPI, HTTPException, Query, Header
from fastapi.responses import RedirectResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel, Field
from typing import Dict, List, Optional
import time
import os

# =========================
# Config básica
# =========================
APP_NAME = "KraveAI API"
VERSION = "1.0.2"
CACHE_TTL_SECONDS = int(os.getenv("KRAVE_CACHE_TTL", "900"))  # 15 min por defecto
PROFILE_MAX_AGE = int(os.getenv("KRAVE_PROFILE_MAX_AGE", "60"))  # seg. cache CDN para /buscar-usuario y /refresh-clients
AVATAR_MAX_AGE = int(os.getenv("KRAVE_AVATAR_MAX_AGE", "86400"))  # 1 día para /avatar
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN")  # opcional: si lo defines, /purge-cache requerirá este token

app = FastAPI(title=APP_NAME, version=VERSION)

# CORS (ajusta allowed_origins a tu dominio si quieres restringir)
allowed_origins = os.getenv("ALLOWED_ORIGINS", "*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in allowed_origins.split(",")] if allowed_origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# GZip para respuestas ligeras
app.add_middleware(GZipMiddleware, minimum_size=512)

# =========================
# Modelos
# =========================
class UserInfo(BaseModel):
    username: str = Field(..., description="Handle sin @")
    full_name: Optional[str] = None
    follower_count: Optional[int] = None
    following_count: Optional[int] = None
    media_count: Optional[int] = None
    biography: Optional[str] = None
    is_verified: Optional[bool] = None

class RefreshReq(BaseModel):
    users: List[str] = Field(default_factory=list, description="Lista de usernames")

class RefreshResp(BaseModel):
    usuarios: Dict[str, UserInfo] = Field(default_factory=dict)

# =========================
# Utilidades (mem-cache + seed)
# =========================
class TTLCache:
    def __init__(self, ttl_seconds: int):
        self.ttl = ttl_seconds
        self.store: Dict[str, Dict] = {}  # key -> {"t": ts, "data": any}

    def get(self, key: str):
        row = self.store.get(key)
        if not row:
            return None
        if (time.time() - row["t"]) > self.ttl:
            self.store.pop(key, None)
            return None
        return row["data"]

    def set(self, key: str, value):
        self.store[key] = {"t": time.time(), "data": value}

    def clear(self):
        self.store.clear()

profile_cache = TTLCache(CACHE_TTL_SECONDS)

def json_cached(payload: dict, max_age: int = 0) -> JSONResponse:
    resp = JSONResponse(payload)
    if max_age > 0:
        resp.headers["Cache-Control"] = f"public, max-age={max_age}"
    else:
        resp.headers["Cache-Control"] = "no-store"
    return resp

# Datos semilla para demo (coinciden con el frontend)
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

    "aaronmercury": UserInfo(username="aaronmercury", full_name="Aaron Mercurio",
                             follower_count=2500000, following_count=400, media_count=800,
                             biography="Creador", is_verified=True),
    "televisadigital": UserInfo(username="televisadigital", full_name="Televisa Digital",
                                follower_count=3200000, following_count=120, media_count=5400,
                                biography="Televisa en digital", is_verified=True),
    "joscanela": UserInfo(username="joscanela", full_name="Jos Canela",
                          follower_count=1200000, following_count=300, media_count=1100,
                          biography="Artista", is_verified=True),
    "jimenagallegotv": UserInfo(username="jimenagallegotv", full_name="Jimena Gállego",
                                follower_count=900000, following_count=500, media_count=2000,
                                biography="TV Host", is_verified=True),
    "elmalilla_": UserInfo(username="elmalilla_", full_name="MALI EL MALILLAA!!🇲🇽",
                           follower_count=850000, following_count=380, media_count=750,
                           biography="Música 🇲🇽", is_verified=True),
    "mariobautista": UserInfo(username="mariobautista", full_name="Mario Bautista (MB)",
                              follower_count=12000000, following_count=600, media_count=3000,
                              biography="MB", is_verified=True),
    "aldotdenigris": UserInfo(username="aldotdenigris", full_name="Aldo Tamez De Nigris",
                              follower_count=700000, following_count=900, media_count=1400,
                              biography="Deportes", is_verified=True),
    "sonymusiclatin": UserInfo(username="sonymusiclatin", full_name="Sony Music Latin",
                               follower_count=8600000, following_count=1000, media_count=8000,
                               biography="Label", is_verified=True),
    "lacasafamososmx": UserInfo(username="lacasafamososmx", full_name="La Casa de los Famosos MX",
                                follower_count=2100000, following_count=150, media_count=1200,
                                biography="Reality MX", is_verified=True),
    "oscar_maydonn": UserInfo(username="oscar_maydonn", full_name="Oscar Maydon",
                              follower_count=2300000, following_count=280, media_count=600,
                              biography="Música", is_verified=True),
}

def seed_or_stub(username: str) -> UserInfo:
    key = username.lower().strip()
    if key in SEED:
        return SEED[key]
    base = abs(hash(key)) % 1_000_000
    return UserInfo(
        username=key,
        full_name=key,
        follower_count=20000 + (base % 50000),
        following_count=100 + (base % 900),
        media_count=50 + (base % 1500),
        biography=f"Perfil de {key}",
        is_verified=False,
    )

# =========================
# Rutas
# =========================
@app.get("/health")
def health():
    return {"status": "ok", "name": APP_NAME, "version": VERSION}

@app.get("/avatar")
def avatar(username: str = Query(..., description="Handle sin @")):
    u = username.strip().lstrip("@")
    resp = RedirectResponse(url=f"https://unavatar.io/instagram/{u}", status_code=302)
    resp.headers["Cache-Control"] = f"public, max-age={AVATAR_MAX_AGE}"
    return resp

@app.get("/buscar-usuario")
def buscar_usuario(username: str = Query(..., description="Handle sin @")):
    u = username.strip().lstrip("@").lower()
    cached = profile_cache.get(f"user:{u}")
    if cached:
        return json_cached({"usuario": cached}, max_age=PROFILE_MAX_AGE)
    info = seed_or_stub(u)
    profile_cache.set(f"user:{u}", info.dict())
    return json_cached({"usuario": info.dict()}, max_age=PROFILE_MAX_AGE)

@app.post("/refresh-clients", response_model=RefreshResp)
def refresh_clients(req: RefreshReq):
    if not req.users:
        raise HTTPException(status_code=400, detail="Falta lista de usuarios")
    result: Dict[str, UserInfo] = {}
    for raw_u in req.users:
        u = (raw_u or "").strip().lstrip("@").lower()
        if not u:
            continue
        cached = profile_cache.get(f"user:{u}")
        if cached:
            result[u] = UserInfo(**cached)
            continue
        info = seed_or_stub(u)
        profile_cache.set(f"user:{u}", info.dict())
        result[u] = info
    payload = RefreshResp(usuarios={k: v for k, v in result.items()})
    resp = JSONResponse(payload.dict())
    resp.headers["Cache-Control"] = f"public, max-age={PROFILE_MAX_AGE}"
    return resp

@app.post("/purge-cache")
def purge_cache(x_admin_token: Optional[str] = Header(default=None)):
    # Si defines ADMIN_TOKEN en el entorno, exige encabezado X-Admin-Token
    if ADMIN_TOKEN and x_admin_token != ADMIN_TOKEN:
        raise HTTPException(status_code=403, detail="Forbidden")
    profile_cache.clear()
    return {"ok": True, "purged": True}

# =========================
# Manejo de errores simple
# =========================
@app.exception_handler(HTTPException)
async def http_exc_handler(_, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})

@app.get("/")
def root():
    return {"ok": True, "service": APP_NAME, "docs": "/docs"}