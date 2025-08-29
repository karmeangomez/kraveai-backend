import re
import time
import hashlib
import requests
from typing import Dict, Any, Optional
from fastapi import FastAPI, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# =======================
# App
# =======================
app = FastAPI(title="Krave API", version="2025.02")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],              # si quieres, restringe a tu dominio
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =======================
# HTTP session con retry
# =======================
def _build_session() -> requests.Session:
    s = requests.Session()
    retries = Retry(
        total=3,
        backoff_factor=0.6,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET", "HEAD", "OPTIONS"],
        raise_on_status=False,
    )
    s.mount("https://", HTTPAdapter(max_retries=retries))
    s.mount("http://", HTTPAdapter(max_retries=retries))
    return s

HTTP = _build_session()

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

# =======================
# Caché simple en memoria
# =======================
_PROFILE_CACHE: Dict[str, Any] = {}       # username -> (exp_ts, data)
_PROFILE_TTL = 60 * 15                    # 15 min

def _now() -> float:
    return time.time()

def _cache_get(u: str) -> Optional[Dict[str, Any]]:
    key = u.lower()
    ent = _PROFILE_CACHE.get(key)
    if not ent:
        return None
    exp, data = ent
    if _now() < exp:
        return data
    _PROFILE_CACHE.pop(key, None)
    return None

def _cache_set(u: str, data: Dict[str, Any]) -> None:
    _PROFILE_CACHE[u.lower()] = (_now() + _PROFILE_TTL, data)

# =======================
# Parsers (fallback HTML)
# =======================
_RE_FOLLOWERS = re.compile(r'"edge_followed_by"\s*:\s*{\s*"count"\s*:\s*(\d+)')
_RE_FOLLOWING = re.compile(r'"edge_follow"\s*:\s*{\s*"count"\s*:\s*(\d+)')
_RE_MEDIA     = re.compile(r'"edge_owner_to_timeline_media"\s*:\s*{\s*"count"\s*:\s*(\d+)')
_RE_BIO       = re.compile(r'"biography"\s*:\s*"((?:\\.|[^"\\])*)"')
_RE_VERIFIED  = re.compile(r'"is_verified"\s*:\s*(true|false)')
_RE_FULLNAME  = re.compile(r'"full_name"\s*:\s*"((?:\\.|[^"\\])*)"')
_RE_PIC_HD    = re.compile(r'"profile_pic_url_hd"\s*:\s*"([^"]+)"')
_RE_PIC       = re.compile(r'"profile_pic_url"\s*:\s*"([^"]+)"')

def _num(x: Any) -> Optional[int]:
    try:
        return int(x)
    except Exception:
        try:
            return int(float(x))
        except Exception:
            return None

def _unesc(s: str) -> str:
    try:
        return bytes(s, "utf-8").decode("unicode_escape")
    except Exception:
        return s

def _scrape(username: str) -> Optional[Dict[str, Any]]:
    """Fallback muy robusto leyendo el HTML público."""
    url = f"https://www.instagram.com/{username}/"
    try:
        r = HTTP.get(url, headers=_ig_headers(), timeout=8)
        if r.status_code != 200 or not r.text:
            return None
        html = r.text
        return {
            "username": username,
            "full_name": _unesc(_RE_FULLNAME.search(html).group(1)) if _RE_FULLNAME.search(html) else username,
            "biography": _unesc(_RE_BIO.search(html).group(1)) if _RE_BIO.search(html) else "",
            "is_verified": (_RE_VERIFIED.search(html).group(1) == "true") if _RE_VERIFIED.search(html) else False,
            "follower_count": _num(_RE_FOLLOWERS.search(html).group(1)) if _RE_FOLLOWERS.search(html) else None,
            "following_count": _num(_RE_FOLLOWING.search(html).group(1)) if _RE_FOLLOWING.search(html) else None,
            "media_count": _num(_RE_MEDIA.search(html).group(1)) if _RE_MEDIA.search(html) else None,
            "profile_pic_url": _RE_PIC.search(html).group(1) if _RE_PIC.search(html) else None,
            "profile_pic_url_hd": _RE_PIC_HD.search(html).group(1) if _RE_PIC_HD.search(html) else None,
        }
    except Exception:
        return None

def _api(username: str) -> Optional[Dict[str, Any]]:
    """Endpoint web no autenticado (cuando responde es la fuente preferida)."""
    api = f"https://i.instagram.com/api/v1/users/web_profile_info/?username={username}"
    try:
        r = HTTP.get(api, headers=_ig_headers(), timeout=8)
        if r.status_code != 200:
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
        }
    except Exception:
        return None

# =======================
# Rutas
# =======================
@app.get("/health")
def health():
    return {"status": "ok", "service": "krave", "version": app.version}

def _normalize_username(u: str) -> str:
    if u.lower() == "cadillaccf1":
        return "cadillacf1"
    return u

@app.get("/buscar-usuario")
def buscar_usuario(username: str = Query(...)):
    if not username:
        return JSONResponse({"error": "username requerido"}, status_code=400)

    username = _normalize_username(username)

    # caché
    cached = _cache_get(username)
    if cached:
        return {"usuario": cached}

    # preferir API; caer a scrape
    data = _api(username) or _scrape(username)

    # fallback mínimo + avatar universal
    if not data:
        data = {
            "username": username,
            "full_name": username,
            "biography": "",
            "is_verified": False,
            "follower_count": None,
            "following_count": None,
            "media_count": None,
            "profile_pic_url": f"https://unavatar.io/instagram/{username}",
            "profile_pic_url_hd": f"https://unavatar.io/instagram/{username}",
        }

    _cache_set(username, data)
    return {"usuario": data}

@app.get("/avatar")
def avatar(
    username: str = Query(..., description="Usuario IG sin @"),
    if_none_match: Optional[str] = Query(None, alias="if-none-match")
):
    """
    Proxy de imagen de avatar:
      - Intenta HD -> normal (IG)
      - Fallback a unavatar.io
      - Devuelve Cache-Control 6h y ETag para 304
    """
    if not username:
        return Response(status_code=400)

    username = _normalize_username(username)

    # resolvemos URLs candidatas (primero IG, luego fallback)
    urls = []
    try:
        info = _api(username) or _scrape(username)
        if info:
            if info.get("profile_pic_url_hd"):
                urls.append(info["profile_pic_url_hd"])
            if info.get("profile_pic_url"):
                urls.append(info["profile_pic_url"])
    except Exception:
        pass
    urls.append(f"https://unavatar.io/instagram/{username}")

    # intentamos descargar la imagen
    img_bytes = None
    content_type = "image/jpeg"
    for url in urls:
        try:
            ir = HTTP.get(url, headers=_ig_headers(), timeout=10, allow_redirects=True)
            if ir.status_code == 200 and ir.content:
                img_bytes = ir.content
                content_type = ir.headers.get("Content-Type", content_type)
                break
        except Exception:
            continue

    if not img_bytes:
        # sin contenido
        return Response(status_code=204)

    # ETag simple por hash (fuerte)
    etag = '"' + hashlib.sha256(img_bytes).hexdigest()[:32] + '"'
    if if_none_match and etag == if_none_match:
        return Response(status_code=304, headers={"ETag": etag, "Cache-Control": "public, max-age=21600"})

    headers = {
        "Content-Type": content_type or "image/jpeg",
        "Cache-Control": "public, max-age=21600",  # 6 horas
        "ETag": etag,
    }
    return Response(content=img_bytes, headers=headers)

# =======================
# Opcional: raíz simple
# =======================
@app.get("/")
def root():
    return {"ok": True, "msg": "Krave API up"}