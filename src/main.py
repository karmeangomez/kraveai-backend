import os
import time
import requests
from fastapi import FastAPI, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from dotenv import load_dotenv
from src.login_utils import (
    login_instagram,
    restaurar_sesion,
    guardar_sesion,
    guardar_cuenta_api,
    cerrar_sesion,
    cuentas_activas,
    cliente_por_usuario,
    buscar_usuario as _legacy_buscar_usuario,  # compat
)

load_dotenv()
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================
# Cache simple en memoria
# ==========================
_PROFILE_CACHE = {}  # { username_lower: (expires_epoch, payload_dict) }
_PROFILE_TTL = 60 * 15  # 15 minutos

def _cache_get(username: str):
    key = (username or "").lower()
    hit = _PROFILE_CACHE.get(key)
    if not hit:
        return None
    exp, data = hit
    if time.time() < exp:
        return data
    _PROFILE_CACHE.pop(key, None)
    return None

def _cache_set(username: str, data: dict):
    key = (username or "").lower()
    _PROFILE_CACHE[key] = (time.time() + _PROFILE_TTL, data)

def _ig_headers():
    return {
        "User-Agent": (
            "Mozilla/5.0 (Linux; Android 13; Pixel 7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Mobile Safari/537.36"
        ),
        "x-ig-app-id": "936619743392459",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
        "Referer": "https://www.instagram.com/",
    }

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/estado-sesion")
def estado_sesion():
    cuentas = cuentas_activas()
    if not cuentas:
        return {"sesion_activa": False}
    return {"sesion_activa": True, "cuentas": cuentas}

@app.post("/iniciar-sesion")
async def iniciar_sesion(request: Request):
    datos = await request.json()
    username = datos.get("username")
    password = datos.get("password")
    if not username or not password:
        return {"error": "Faltan credenciales"}

    try:
        cl = login_instagram(username, password)
        if cl:
            guardar_sesion(cl, username)
            guardar_cuenta_api(username, password)
            return {"status": "ok"}
    except Exception as e:
        return {"error": str(e)}

    return {"error": "Login fallido"}

@app.get("/cuentas-activas")
def obtener_cuentas():
    return {"cuentas": cuentas_activas()}

@app.post("/guardar-cuenta")
async def guardar_cuenta(request: Request):
    datos = await request.json()
    username = datos.get("username")
    password = datos.get("password")
    if not username or not password:
        return {"error": "Faltan datos"}
    guardar_cuenta_api(username, password)
    return {"status": "guardado"}

@app.post("/cerrar-sesion")
async def cerrar(request: Request):
    datos = await request.json()
    username = datos.get("username")
    if not username:
        return {"error": "Falta el username"}
    cerrar_sesion(username)
    return {"status": "sesión cerrada"}

# --------------------------------------------
# Helpers
# --------------------------------------------
def _normalize_username(raw: str) -> str:
    if not raw:
        return ""
    u = raw.strip().lstrip("@")
    if u.lower() == "cadillaccf1":  # corrección que mencionaste
        u = "cadillacf1"
    return u

def _to_int(val):
    # El endpoint web ya devuelve ints, pero por si acaso:
    try:
        if val is None:
            return None
        if isinstance(val, (int, float)):
            return int(val)
        s = str(val).replace(",", "").strip()
        return int(s)
    except Exception:
        return None

# ============================================
# /buscar-usuario → datos REALES sin sesión
# ============================================
@app.get("/buscar-usuario")
def buscar(username: str = Query(...)):
    """
    Devuelve datos REALES sin iniciar sesión:
    {
      username, full_name, biography, is_verified,
      follower_count, following_count, media_count,
      profile_pic_url, profile_pic_url_hd
    }
    Cacheado 15 min para evitar rate-limits.
    """
    try:
        if not username:
            return {"error": "username requerido"}

        username = _normalize_username(username)

        # Cache
        cached = _cache_get(username)
        if cached:
            return {"usuario": cached, "cached": True}

        # 1) Si hay cliente logueado disponible, úsalo (más estable)
        try:
            bot = cliente_por_usuario("kraveaibot")
        except Exception:
            bot = None

        if bot:
            try:
                u = bot.user_info_by_username(username)
                payload = {
                    "username": u.username or username,
                    "full_name": u.full_name or username,
                    "biography": u.biography or "",
                    "is_verified": bool(getattr(u, "is_verified", False)),
                    "follower_count": _to_int(getattr(u, "follower_count", None)),
                    "following_count": _to_int(getattr(u, "following_count", None)),
                    "media_count": _to_int(getattr(u, "media_count", None)),
                    "profile_pic_url": getattr(u, "profile_pic_url", None),
                    "profile_pic_url_hd": getattr(u, "profile_pic_url", None),
                }
                _cache_set(username, payload)
                return {"usuario": payload, "cached": False}
            except Exception:
                # cae a web pública
                pass

        # 2) Fallback web pública
        ig_api = f"https://i.instagram.com/api/v1/users/web_profile_info/?username={username}"
        r = requests.get(ig_api, headers=_ig_headers(), timeout=10)
        r.raise_for_status()
        data = r.json()
        u = (data.get("data") or {}).get("user") or {}

        follower_count = _to_int((u.get("edge_followed_by") or {}).get("count"))
        following_count = _to_int((u.get("edge_follow") or {}).get("count"))
        media_count = _to_int((u.get("edge_owner_to_timeline_media") or {}).get("count"))

        payload = {
            "username": u.get("username") or username,
            "full_name": u.get("full_name") or username,
            "biography": u.get("biography") or "",
            "is_verified": bool(u.get("is_verified")),
            "follower_count": follower_count,
            "following_count": following_count,
            "media_count": media_count,
            "profile_pic_url": u.get("profile_pic_url_hd") or u.get("profile_pic_url"),
            "profile_pic_url_hd": u.get("profile_pic_url_hd"),
        }

        _cache_set(username, payload)
        return {"usuario": payload, "cached": False}

    except Exception as e:
        # Fallback: intenta al menos una foto (sin números)
        pic = None
        try:
            ua = f"https://unavatar.io/instagram/{username}"
            ur = requests.get(ua, timeout=6)
            if ur.status_code == 200:
                pic = ua
        except Exception:
            pass

        payload = {
            "username": username,
            "full_name": username,
            "biography": "",
            "is_verified": None,
            "follower_count": None,
            "following_count": None,
            "media_count": None,
            "profile_pic_url": pic,
            "profile_pic_url_hd": None,
            "error": str(e),
        }
        _cache_set(username, payload)
        return {"usuario": payload, "cached": True}

# ======================
# NUEVO ENDPOINT: Avatar
# ======================
@app.get("/avatar")
def avatar(username: str = Query(...)):
    """
    Devuelve la foto de perfil pública de Instagram como bytes (image/jpeg/png).
    - Intenta primero con el endpoint web de Instagram
    - Si falla, usa Unavatar
    - Si ambos fallan, responde 204
    """
    username = _normalize_username(username)
    ig_api = f"https://i.instagram.com/api/v1/users/web_profile_info/?username={username}"
    headers = _ig_headers()

    try:
        r = requests.get(ig_api, headers=headers, timeout=6)
        if r.status_code == 200:
            data = r.json()
            user = data.get("data", {}).get("user", {})
            pic = user.get("profile_pic_url_hd") or user.get("profile_pic_url")

            if pic:
                ir = requests.get(pic, headers=headers, timeout=8)
                if ir.status_code == 200 and ir.content:
                    ctype = ir.headers.get("Content-Type", "image/jpeg")
                    return Response(
                        content=ir.content,
                        media_type=ctype,
                        headers={"Cache-Control": "public, max-age=21600"}  # 6h
                    )
    except Exception:
        pass

    # Fallback: Unavatar
    try:
        ua = f"https://unavatar.io/instagram/{username}"
        ur = requests.get(ua, timeout=6)
        if ur.status_code == 200 and ur.content:
            ctype = ur.headers.get("Content-Type", "image/png")
            return Response(
                content=ur.content,
                media_type=ctype,
                headers={"Cache-Control": "public, max-age=21600"}
            )
    except Exception:
        pass

    return Response(status_code=204)