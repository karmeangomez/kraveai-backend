# main.py  — SWR + cache persistente + bulk
import time, re, json, threading, os
from typing import Dict, Any, Optional, List
import requests
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

APP_NAME = "Krave API"
APP_VER  = "2025.02-swr"

# ========================
# HTTP session + headers
# ========================
def _build_session()->requests.Session:
    s = requests.Session()
    retries = Retry(
        total=3,
        backoff_factor=0.6,
        status_forcelist=[429,500,502,503,504],
        allowed_methods=["GET","HEAD","OPTIONS"],
        raise_on_status=False
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

# ========================
# Cache (memoria + disco)
# ========================
CACHE_FILE      = "profiles_cache.json"
FRESH_TTL       = 60*15      # 15 min (sirve fresco)
STALE_WINDOW    = 60*60*6    # 6 h (sirve vencido y refresca en background)
SOFT_TTL        = 60*2       # 2 min (para fallbacks mínimos)
_now            = time.time
_cache_mem: Dict[str, Any] = {}
_cache_lock     = threading.Lock()

def _load_cache_file()->Dict[str,Any]:
    if not os.path.exists(CACHE_FILE): return {}
    try:
        with open(CACHE_FILE,"r",encoding="utf-8") as f:
            return json.load(f)
    except:
        return {}

def _save_cache_file(store:Dict[str,Any])->None:
    tmp = CACHE_FILE + ".tmp"
    try:
        with open(tmp,"w",encoding="utf-8") as f:
            json.dump(store,f,ensure_ascii=False)
        os.replace(tmp, CACHE_FILE)
    except:
        pass

_cache_disk = _load_cache_file()

def _cache_get(u:str):
    key = u.lower()
    with _cache_lock:
        ent = _cache_mem.get(key) or _cache_disk.get(key)
    if not ent: return None
    return ent  # {data, ts, ttl}

def _cache_set(u:str, data:Dict[str,Any], ttl:int):
    key = u.lower()
    ent = {"data": data, "ts": _now(), "ttl": ttl}
    with _cache_lock:
        _cache_mem[key] = ent
        _cache_disk[key] = ent
        _save_cache_file(_cache_disk)

def _is_fresh(ent)->bool:
    return (_now() - ent["ts"]) < ent["ttl"]

def _is_within_stale_window(ent)->bool:
    # Se considera servible hasta ts+ttl+STALE_WINDOW
    return (_now() - ent["ts"]) < (ent["ttl"] + STALE_WINDOW)

# =======================
# Parsers / fallbacks IG
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
    try: return bytes(s,"utf-8").decode("unicode_escape")
    except: return s

def _to_int(x):
    try: return int(x)
    except:
        try: return int(float(x))
        except: return None

def _api_profile(username:str)->Optional[Dict[str,Any]]:
    url = f"https://i.instagram.com/api/v1/users/web_profile_info/?username={username}"
    r = HTTP.get(url, headers=_ig_headers(), timeout=8)
    if r.status_code != 200: return None
    u = (r.json().get("data") or {}).get("user") or {}
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
    if r.status_code != 200 or not r.text: return None
    h = r.text
    return {
        "username": username,
        "full_name": _unesc((_RE["name"].search(h) or [None, username])[1]),
        "biography": _unesc((_RE["bio"].search(h) or [None, ""])[1]),
        "is_verified": ((_RE["verified"].search(h) or [None, "false"])[1] == "true"),
        "follower_count": _to_int((_RE["followers"].search(h) or [None, None])[1]),
        "following_count": _to_int((_RE["following"].search(h) or [None, None])[1]),
        "media_count": _to_int((_RE["media"].search(h) or [None, None])[1]),
        "profile_pic_url": (_RE["pic"].search(h) or [None, None])[1],
        "profile_pic_url_hd": (_RE["pic_hd"].search(h) or [None, None])[1],
        "source": "scrape",
    }

def _unavatar(username:str)->str:
    return f"https://unavatar.io/instagram/{username}"

def _ensure_picture(d:Dict[str,Any]):
    if not d.get("profile_pic_url_hd") and not d.get("profile_pic_url"):
        d["profile_pic_url"] = _unavatar(d["username"])
        d["profile_pic_url_hd"] = d["profile_pic_url"]

# ==============
# Refresh async
# ==============
def _refresh_in_background(username:str):
    def _job():
        data = _api_profile(username) or _scrape_profile(username)
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
            soft = True
        _ensure_picture(data)
        _cache_set(username, data, ttl=(SOFT_TTL if soft else FRESH_TTL))
    threading.Thread(target=_job, daemon=True).start()

# ==========
# FastAPI
# ==========
app = FastAPI(title=APP_NAME, version=APP_VER)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # si quieres: ["https://kraveai.netlify.app"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status":"ok","service":"krave","version":APP_VER}

@app.get("/flush-cache")
def flush_cache():
    with _cache_lock:
        _cache_mem.clear()
        _cache_disk.clear()
        _save_cache_file(_cache_disk)
    return {"status":"ok","cleared":True}

# ------------------
# SINGLE USER (SWR)
# ------------------
@app.get("/buscar-usuario")
def buscar_usuario(
    username: str = Query(...),
    nocache: int = Query(0, description="1 para ignorar cache y forzar refresh"),
):
    if not username:
        return JSONResponse({"error":"username requerido"}, status_code=400)
    if username.lower()=="cadillaccf1":
        username = "cadillacf1"

    if not nocache:
        ent = _cache_get(username)
        if ent:
            fresh = _is_fresh(ent)
            # Si está fresco: devolver tal cual
            if fresh:
                return {"usuario": ent["data"], "cached": True, "stale": False}
            # Si está “stale” pero dentro de ventana: devolver y refrescar detrás
            if _is_within_stale_window(ent):
                _refresh_in_background(username)
                return {"usuario": ent["data"], "cached": True, "stale": True}

    # No hay cache utilizable -> obtener ahora
    data = _api_profile(username) or _scrape_profile(username)
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
        soft = True
    _ensure_picture(data)
    _cache_set(username, data, ttl=(SOFT_TTL if soft else FRESH_TTL))
    return {"usuario": data, "cached": False, "stale": False}

# ------------------
# BULK (más rápido)
# ------------------
@app.get("/buscar-usuarios")
def buscar_usuarios(
    usernames: str = Query(..., description="coma-separado: user1,user2,..."),
):
    arr = [u.strip() for u in usernames.split(",") if u.strip()]
    out: Dict[str, Any] = {}
    for u in arr:
        out[u] = buscar_usuario(u, 0)  # reuse lógica, usa SWR
    return out

# ---------------
# AVATAR proxy
# ---------------
@app.get("/avatar")
def avatar(username: str = Query(...)):
    if not username: return Response(status_code=400)
    if username.lower()=="cadillaccf1": username="cadillacf1"

    # 1) Unavatar (rápido y cacheable por CDN)
    try:
        ua = _unavatar(username)
        ur = HTTP.get(ua, timeout=8)
        if ur.status_code==200 and ur.content:
            ctype = ur.headers.get("Content-Type","image/png")
            return Response(ur.content, media_type=ctype,
                            headers={"Cache-Control":"public, max-age=21600"})  # 6h
    except: pass

    # 2) IG directo (fallback)
    for getter in (_api_profile, _scrape_profile):
        try:
            info = getter(username)
            pic = (info or {}).get("profile_pic_url_hd") or (info or {}).get("profile_pic_url")
            if pic:
                ir = HTTP.get(pic, headers=_ig_headers(), timeout=8)
                if ir.status_code==200 and ir.content:
                    ctype = ir.headers.get("Content-Type","image/jpeg")
                    return Response(ir.content, media_type=ctype,
                                    headers={"Cache-Control":"public, max-age=21600"})
        except: pass
    return Response(status_code=204)