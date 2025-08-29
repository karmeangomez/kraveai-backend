import os
import re
import json
import time
import requests
from typing import Optional, Dict, Any
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
app = FastAPI(title="Krave API", version="2025.02")

# ---------------- CORS ----------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # si quieres restringir, cámbialo
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------- HTTP session con retry ----------------
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

def _build_session() -> requests.Session:
    s = requests.Session()
    retries = Retry(
        total=3,
        backoff_factor=0.6,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET", "HEAD", "OPTIONS"]
    )
    s.mount("https://", HTTPAdapter(max_retries=retries))
    s.mount("http://", HTTPAdapter(max_retries=retries))
    return s

HTTP = _build_session()

# ---------------- Helpers ----------------
def _ig_headers() -> Dict[str, str]:
    return {
        "User-Agent": (
            "Mozilla/5.0 (Linux; Android 13; Pixel 7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Mobile Safari/537.36"
        ),
        "x-ig-app-id": "936619743392459",
        "Accept": "application/json, text/plain, */*",
        "Referer": "https://www.instagram.com/",
    }

def _now() -> float:
    return time.time()

# ---------------- Cache simple ----------------
_PROFILE_CACHE: Dict[str, Any] = {}   # username_lower -> (exp_epoch, payload_dict)
_PROFILE_TTL = 60 * 15  # 15 min

def _cache_get(username: str) -> Optional[Dict[str, Any]]:
    key = (username or "").lower()
    hit = _PROFILE_CACHE.get(key)
    if not hit:
        return None
    exp, data = hit
    if _now() < exp:
        return data
    _PROFILE_CACHE.pop(key, None)
    return None

def _cache_set(username: str, data: Dict[str, Any]):
    key = (username or "").lower()
    _PROFILE_CACHE[key] = (_now() + _PROFILE_TTL, data)

def _num(x):
    try:
        return int(x)
    except Exception:
        try:
            return int(float(x))
        except Exception:
            return None

# ---------------- Scrape fallback (HTML) ----------------
# Extrae JSON embebido de la página del perfil y toma: pic_hd, bio, counts, verified, name
_RE_JSON = re.compile(r'("profile_pic_url_hd"\s*:\s*")(https?:\/\/[^"]+)')
_RE_FOLLOWERS = re.compile(r'"edge_followed_by"\s*:\s*{\s*"count"\s*:\s*(\d+)')
_RE_FOLLOWING = re.compile(r'"edge_follow"\s*:\s*{\s*"count"\s*:\s*(\d+)')
_RE_MEDIA = re.compile(r'"edge_owner_to_timeline_media"\s*:\s*{\s*"count"\s*:\s*(\d+)')
_RE_BIO = re.compile(r'"biography"\s*:\s*"((?:\\.|[^"\\])*)"')
_RE_VERIFIED = re.compile(r'"is_verified"\s*:\s*(true|false)')
_RE_FULLNAME = re.compile(r'"full_name"\s*:\s*"((?:\\.|[^"\\])*)"')
_RE_USERNAME = re.compile(r'"username"\s*:\s*"([A-Za-z0-9._]+)"')

def _unescape_js(s: str) -> str:
    try:
        return bytes(s, "utf-8").decode("unicode_escape")
    except Exception:
        return s

def _scrape_instagram_profile(username: str) -> Optional[Dict[str, Any]]:
    """
    Fallback si el endpoint JSON falla. Lee el HTML del perfil y
    extrae campos por regex desde el JSON embebido.
    """
    url = f"https://www.instagram.com/{username}/"
    try:
        r = HTTP.get(url, headers=_ig_headers(), timeout=8)
        if r.status_code != 200 or not r.text:
            return None
        html = r.text

        # Campos
        pic = None
        m = _RE_JSON.search(html)
        if m:
            pic = m.group(2).encode("utf-8").decode("unicode_escape")

        followers = None
        mf = _RE_FOLLOWERS.search(html)
        if mf: followers = _num(mf.group(1))

        following = None
        mfo = _RE_FOLLOWING.search(html)
        if mfo: following = _num(mfo.group(1))

        media = None
        mm = _RE_MEDIA.search(html)
        if mm: media = _num(mm.group(1))

        bio = ""
        mb = _RE_BIO.search(html)
        if mb:
            bio = _unescape_js(mb.group(1)).replace("\\n", "\n")

        is_verified = None
        mv = _RE_VERIFIED.search(html)
        if mv: is_verified = (mv.group(1) == "true")

        full_name = None
        mn = _RE_FULLNAME.search(html)
        if mn: full_name = _unescape_js(mn.group(1))

        uname = username
        mu = _RE_USERNAME.search(html)
        if mu: uname = mu.group(1)

        payload = {
            "username": uname or username,
            "full_name": full_name or username,
            "biography": bio or "",
            "is_verified": is_verified,
            "follower_count": followers,
            "following_count": following,
            "media_count": media,
            "profile_pic_url": pic,
            "profile_pic_url_hd": pic,
        }

        # Si todo vino None, descarta
        if not any([pic, bio, followers, following, media, is_verified, full_name]):
            return None

        return payload
    except Exception:
        return None

# ---------------- API Instagram (web_profile_info) ----------------
def _fetch_instagram_profile_api(username: str) -> Optional[Dict[str, Any]]:
    api = f"https://i.instagram.com/api/v1/users/web_profile_info/?username={username}"
    try:
        r = HTTP.get(api, headers=_ig_headers(), timeout=8)
        if r.status_code != 200:
            return None
        data = r.json()
        u = (data.get("data") or {}).get("user") or {}
        follower_count = (u.get("edge_followed_by") or {}).get("count")
        following_count = (u.get("edge_follow") or {}).get("count")
        media_count = (u.get("edge_owner_to_timeline_media") or {}).get("count")

        payload = {
            "username": u.get("username") or username,
            "full_name": u.get("full_name") or username,
            "biography": u.get("biography") or "",
            "is_verified": bool(u.get("is_verified")) if u.get("is_verified") is not None else None,
            "follower_count": _num(follower_count),
            "following_count": _num(following_count),
            "media_count": _num(media_count),
            "profile_pic_url": u.get("profile_pic_url") or u.get("profile_pic_url_hd"),
            "profile_pic_url_hd": u.get("profile_pic_url_hd"),
        }
        # Si no hay nada útil, retorna None
        if not any([payload.get("profile_pic_url"), payload.get("biography"),
                    payload.get("follower_count"), payload.get("media_count")]):
            return None
        return payload
    except Exception:
        return None

# =========================
# Endpoints básicos / sesión
# =========================
@app.get("/health")
def health():
    return {"status": "ok", "service": "krave", "version": app.version}

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
    Devuelve datos REALES (cache 15 min).
    Campos: username, full_name, biography, is_verified,
            follower_count, following_count, media_count,
            profile_pic_url, profile_pic_url_hd
    """
    if not username:
        return {"error": "username requerido"}

    # corrige handle que estaba mal tipeado previamente
    if username.lower() == "cadillaccf1":
        username = "cadillacf1"

    # Cache
    cached = _cache_get(username)
    if cached:
        return {"usuario": cached, "cached": True}

    # 1) API oficial web_profile_info
    info = _fetch_instagram_profile_api(username)

    # 2) Fallback scraping si API falla o viene vacía
    if not info:
        info = _scrape_instagram_profile(username)

    # 3) Último recurso: sólo avatar (unavatar) y mínimos
    if not info:
        # intenta al menos una foto (no números garantizados)
        pic = None
        try:
            ua = f"https://unavatar.io/instagram/{username}"
            ur = HTTP.get(ua, timeout=6)
            if ur.status_code == 200:
                pic = ua
        except Exception:
            pass
        info = {
            "username": username,
            "full_name": username,
            "biography": "",
            "is_verified": None,
            "follower_count": None,
            "following_count": None,
            "media_count": None,
            "profile_pic_url": pic,
            "profile_pic_url_hd": None,
        }

    # Cachea si hay algo razonable (al menos pic o follower_count)
    if any([info.get("profile_pic_url"), info.get("follower_count"), info.get("biography")]):
        _cache_set(username, info)

    return {"usuario": info, "cached": False}

# ======================
# /avatar: devuelve bytes
# ======================
@app.get("/avatar")
def avatar(username: str = Query(...)):
    """
    Devuelve la foto de perfil pública de Instagram como bytes (image/*).
    Orden:
      1) API web_profile_info -> descarga directo
      2) Scraping HTML del perfil -> descarga directo
      3) Unavatar
      4) 204 si todo falla
    """
    if not username:
        return Response(status_code=400)

    # normaliza handle
    if username.lower() == "cadillaccf1":
        username = "cadillacf1"

    headers = _ig_headers()

    # A) intenar vía API web_profile_info
    try:
        prof = _fetch_instagram_profile_api(username)
        pic = prof.get("profile_pic_url_hd") or prof.get("profile_pic_url") if prof else None
        if pic:
            ir = HTTP.get(pic, headers=headers, timeout=8)
            if ir.status_code == 200 and ir.content:
                ctype = ir.headers.get("Content-Type", "image/jpeg")
                return Response(
                    content=ir.content,
                    media_type=ctype,
                    headers={"Cache-Control": "public, max-age=21600"}  # 6h
                )
    except Exception:
        pass

    # B) fallback scraping HTML
    try:
        prof = _scrape_instagram_profile(username)
        pic = prof.get("profile_pic_url_hd") or prof.get("profile_pic_url") if prof else None
        if pic:
            ir = HTTP.get(pic, headers=headers, timeout=8)
            if ir.status_code == 200 and ir.content:
                ctype = ir.headers.get("Content-Type", "image/jpeg")
                return Response(
                    content=ir.content,
                    media_type=ctype,
                    headers={"Cache-Control": "public, max-age=21600"}  # 6h
                )
    except Exception:
        pass

    # C) Unavatar
    try:
        ua = f"https://unavatar.io/instagram/{username}"
        ur = HTTP.get(ua, timeout=6)
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

# ======================
# Endpoints de diagnóstico
# ======================
@app.get("/debug/user")
def debug_user(username: str = Query(...)):
    """
    Devuelve cómo se resolvió el usuario (qué capa funcionó).
    """
    res = {
        "username": username,
        "steps": [],
    }

    # intenta API
    api_data = _fetch_instagram_profile_api(username)
    res["steps"].append({"api_web_profile_info": bool(api_data)})
    if api_data:
        res["result"] = api_data
        return JSONResponse(res)

    # intenta scrape
    html_data = _scrape_instagram_profile(username)
    res["steps"].append({"html_scrape": bool(html_data)})
    if html_data:
        res["result"] = html_data
        return JSONResponse(res)

    # intenta unavatar
    ok = False
    try:
        ua = f"https://unavatar.io/instagram/{username}"
        ur = HTTP.get(ua, timeout=6)
        ok = (ur.status_code == 200)
    except Exception:
        ok = False
    res["steps"].append({"unavatar": ok})
    if ok:
        res["result"] = {"profile_pic_url": ua}
    else:
        res["result"] = None
    return JSONResponse(res)

@app.get("/debug/avatar")
def debug_avatar(username: str = Query(...)):
    """
    Muestra sólo la URL (si existe) que se intentará descargar.
    """
    out = {"username": username, "pic": None, "path": None}

    api = _fetch_instagram_profile_api(username)
    if api and (api.get("profile_pic_url_hd") or api.get("profile_pic_url")):
        out["pic"] = api.get("profile_pic_url_hd") or api.get("profile_pic_url")
        out["path"] = "api_web_profile_info"
        return out

    scr = _scrape_instagram_profile(username)
    if scr and (scr.get("profile_pic_url_hd") or scr.get("profile_pic_url")):
        out["pic"] = scr.get("profile_pic_url_hd") or scr.get("profile_pic_url")
        out["path"] = "html_scrape"
        return out

    out["pic"] = f"https://unavatar.io/instagram/{username}"
    out["path"] = "unavatar"
    return out