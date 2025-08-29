import os
import json
import time
import requests
from fastapi import FastAPI, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, JSONResponse
from dotenv import load_dotenv
from src.login_utils import (
    login_instagram,
    restaurar_sesion,
    guardar_sesion,
    guardar_cuenta_api,
    cerrar_sesion,
    cuentas_activas,
    cliente_por_usuario,
    buscar_usuario as _legacy_buscar_usuario  # compat
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
        "User-Agent": "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
        "x-ig-app-id": "936619743392459",
        "Accept": "application/json, text/plain, */*",
        "Referer": "https://www.instagram.com/",
    }

# ==========================
# Health (no-cache de verdad)
# ==========================
@app.get("/health")
def health():
    return JSONResponse(
        {"status": "ok", "ts": int(time.time())},
        headers={"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"}
    )

# ==========================
# Sesiones
# ==========================
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

        # Corrige handle mal tipeado reportado
        if username.lower() == "cadillaccf1":
            username = "cadillacf1"

        # Cache
        cached = _cache_get(username)
        if cached:
            return JSONResponse(
                {"usuario": cached, "cached": True},
                headers={"Cache-Control": "no-store"}
            )

        ig_api = f"https://i.instagram.com/api/v1/users/web_profile_info/?username={username}"
        r = requests.get(ig_api, headers=_ig_headers(), timeout=10)
        r.raise_for_status()
        data = r.json()
        u = (data.get("data") or {}).get("user") or {}

        # contadores
        follower_count = (u.get("edge_followed_by") or {}).get("count")
        following_count = (u.get("edge_follow") or {}).get("count")
        media_count = (u.get("edge_owner_to_timeline_media") or {}).get("count")

        def to_int(val):
            try:
                if isinstance(val, (int, float)):
                    return int(val)
                if isinstance(val, str) and val.isdigit():
                    return int(val)
            except Exception:
                pass
            return None

        payload = {
            "username": u.get("username") or username,
            "full_name": u.get("full_name") or username,
            "biography": u.get("biography") or "",
            "is_verified": bool(u.get("is_verified")),
            "follower_count": to_int(follower_count),
            "following_count": to_int(following_count),
            "media_count": to_int(media_count),
            "profile_pic_url": u.get("profile_pic_url_hd") or u.get("profile_pic_url"),
            "profile_pic_url_hd": u.get("profile_pic_url_hd"),
        }

        _cache_set(username, payload)
        return JSONResponse(
            {"usuario": payload, "cached": False},
            headers={"Cache-Control": "no-store"}
        )

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
        return JSONResponse(
            {"usuario": payload, "cached": True},
            headers={"Cache-Control": "no-store"}
        )

# ======================
# /avatar: imagen binaria
# ======================
@app.get("/avatar")
def avatar(username: str = Query(...)):
    """
    Devuelve la foto de perfil pública de Instagram como bytes (image/jpeg/png).
    - Intenta primero con el endpoint web de Instagram
    - Si falla, usa Unavatar
    - Si ambos fallan, responde 204
    """
    headers = _ig_headers()
    ig_api = f"https://i.instagram.com/api/v1/users/web_profile_info/?username={username}"

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
                        headers={"Cache-Control": "public, max-age=21600"}
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