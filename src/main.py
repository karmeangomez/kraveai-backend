# main.py
import time, re, json
from typing import Dict, Any, Optional
import requests
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

APP_NAME   = "Krave API"
APP_VER    = "2025.02-fix401"

def _build_session()->requests.Session:
    s = requests.Session()
    retries = Retry(
        total=3,
        backoff_factor=0.6,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET", "HEAD", "OPTIONS"],
        raise_on_status=False,
    )
    s.mount("https://", HTTPAdapter(max_retries=retries))
    s.mount("http://",  HTTPAdapter(max_retries=retries))
    return s

HTTP = _build_session()

def _ig_headers()->Dict[str,str]:
    return {
        "User-Agent": ("Mozilla/5.0 (Linux; Android 13; Pixel 7) "
                       "AppleWebKit/537.36 (KHTML, like Gecko) "
                       "Chrome/124.0.0.0 Mobile Safari/537.36"),
        "x-ig-app-id": "936619743392459",
        "Accept": "application/json, text/plain, */*",
        "Referer": "https://www.instagram.com/",
    }

# =======================
# Cache simple en memoria
# =======================
_CACHE: Dict[str, Any] = {}
_TTL_OK   = 60 * 15   # 15 min para respuestas buenas
_TTL_SOFT = 60 * 2    # 2 min para respuestas mínimas/fallback
_now = time.time

def _cache_get(key:str)->Optional[Dict[str,Any]]:
    ent = _CACHE.get(key.lower())
    if not ent: return None
    exp, data = ent
    if _now() < exp:
        return data
    _CACHE.pop(key.lower(), None)
    return None

def _cache_set(key:str, data:Dict[str,Any], soft:bool=False):
    ttl = _TTL_SOFT if soft else _TTL_OK
    _CACHE[key.lower()] = (_now() + ttl, data)

# =======================
# Parsers / fallbacks
# =======================
_RE = {
    "followers": re.compile(r'"edge_followed_by"\s*:\s*{\s*"count"\s*:\s*(\d+)'),
    "following": re.compile(r'"edge_follow"\s*:\s*{\s*"count"\s*:\s*(\d+)'),
    "media":     re.compile(r'"edge_owner_to_timeline_media"\s*:\s*{\s*"count"\s*:\s*(\d+)'),
    "bio":       re.compile(r'"biography"\s*:\s*"((?:\\.|[^"\\])*)"'),
    "verified":  re.compile(r'"is_verified"\s*:\s*(true|false)'),
    "name":      re.compile(r'"full_name"\s*:\s*"((?:\\.|[^"\\])*)"'),
    "pic_hd":    re.compile(r'"profile_pic_url_hd"\s*:\s*"([^"]+)"'),
    "pic":       re.compile(r'"profile_pic_url"\s*:\s*"([^"]+)"'),
}

def _unesc(s:str)->str:
    try:    return bytes(s, "utf-8").decode("unicode_escape")
    except: return s

def _to_int(x):
    try: return int(x)
    except:
        try: return int(float(x))
        except: return None

def _api_profile(username:str)->Optional[Dict[str,Any]]:
    url = f"https://i.instagram.com/api/v1/users/web_profile_info/?username={username}"
    r = HTTP.get(url, headers=_ig_headers(), timeout=8)
    if r.status_code != 200:
        # No levantes excepción; devolvemos None para que caiga a scraping
        return None
    data = r.json()
    u = (data.get("data") or {}).get("user") or {}
    return {
        "username": u.get("username") or username,
        "full_name": u.get("full_name") or username,
        "biography": u.get("biography") or "",
        "is_verified": bool(u.get("is_verified")),
        "follower_count": (u.get("edge_followed_by") or {}).get("count"),
        "following_count": (u.get("edge_follow") or {}).get("count"),
        "media_count": (u.get("edge_owner_to_timeline_media") or {}).get("count"),
        "profile_pic_url": u.get("profile_pic_url"),
        "profile_pic_url_hd": u.get("profile_pic_url_hd"),
        "source": "api",
    }

def _scrape_profile(username:str)->Optional[Dict[str,Any]]:
    url = f"https://www.instagram.com/{username}/"
    r = HTTP.get(url, headers=_ig_headers(), timeout=8)
    if r.status_code != 200 or not r.text:
        return None
    html = r.text
    return {
        "username": username,
        "full_name": _unesc((_RE["name"].search(html) or [None, username])[1]),
        "biography": _unesc((_RE["bio"].search(html) or [None, ""])[1]),
        "is_verified": ((_RE["verified"].search(html) or [None, "false"])[1] == "true"),
        "follower_count": _to_int((_RE["followers"].search(html) or [None, None])[1]),
        "following_count": _to_int((_RE["following"].search(html) or [None, None])[1]),
        "media_count": _to_int((_RE["media"].search(html) or [None, None])[1]),
        "profile_pic_url": (_RE["pic"].search(html) or [None, None])[1],
        "profile_pic_url_hd": (_RE["pic_hd"].search(html) or [None, None])[1],
        "source": "scrape",
    }

def _unavatar(username:str)->str:
    # 100% público y estable
    return f"https://unavatar.io/instagram/{username}"

def _ensure_picture(data:Dict[str,Any])->None:
    if not data.get("profile_pic_url_hd") and not data.get("profile_pic_url"):
        # siempre devolvemos una foto aunque IG falle
        data["profile_pic_url"] = _unavatar(data["username"])
        data["profile_pic_url_hd"] = data["profile_pic_url"]

# ==========
# FastAPI
# ==========
app = FastAPI(title=APP_NAME, version=APP_VER)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # si quieres: ["https://kraveai.netlify.app"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok", "service": "krave", "version": APP_VER}

@app.get("/flush-cache")
def flush_cache():
    _CACHE.clear()
    return {"status": "ok", "cleared": True}

@app.get("/buscar-usuario")
def buscar_usuario(
    username: str = Query(...),
    nocache: int = Query(0, description="1 para saltar cache"),
):
    if not username:
        return JSONResponse({"error": "username requerido"}, status_code=400)

    # typo común arreglado
    if username.lower() == "cadillaccf1":
        username = "cadillacf1"

    # Cache
    if not nocache:
        cached = _cache_get(username)
        if cached:
            return {"usuario": cached, "cached": True}

    # 1) API IG (puede devolver 401/403/429)
    data = _api_profile(username)

    # 2) Scraping simple si la API no sirvió
    if not data:
        data = _scrape_profile(username)

    # 3) Fallback mínimo
    soft = False
    if not data:
        data = {
            "username": username,
            "full_name": username,
            "biography": "",
            "is_verified": False,
            "follower_count": None,
            "following_count": None,
            "media_count": None,
            "profile_pic_url": _unavatar(username),
            "profile_pic_url_hd": _unavatar(username),
            "source": "fallback",
        }
        soft = True  # cache corto para no martillar

    # Asegura foto siempre
    _ensure_picture(data)

    # No caches errores “vacíos” por largo tiempo
    _cache_set(username, data, soft=soft)

    return {"usuario": data, "cached": False}

@app.get("/avatar")
def avatar(username: str = Query(...)):
    if not username:
        return Response(status_code=400)
    if username.lower() == "cadillaccf1":
        username = "cadillacf1"

    # Estrategia: Unavatar primero (más estable), luego IG directo
    try:
        ua = _unavatar(username)
        ur = HTTP.get(ua, timeout=8)
        if ur.status_code == 200 and ur.content:
            ctype = ur.headers.get("Content-Type", "image/png")
            return Response(
                ur.content,
                media_type=ctype,
                headers={"Cache-Control": "public, max-age=21600"},
            )
    except:
        pass

    # Intento IG (si Unavatar no tuvo imagen)
    for getter in (_api_profile, _scrape_profile):
        try:
            info = getter(username)
            pic = (info or {}).get("profile_pic_url_hd") or (info or {}).get("profile_pic_url")
            if pic:
                ir = HTTP.get(pic, headers=_ig_headers(), timeout=8)
                if ir.status_code == 200 and ir.content:
                    ctype = ir.headers.get("Content-Type", "image/jpeg")
                    return Response(
                        ir.content,
                        media_type=ctype,
                        headers={"Cache-Control": "public, max-age=21600"},
                    )
        except:
            pass

    return Response(status_code=204)