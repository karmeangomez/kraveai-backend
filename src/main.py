import re, time, requests
from typing import Dict, Any
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, JSONResponse
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

app = FastAPI(title="Krave API", version="2025.02")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # puedes restringir: ["https://kraveai.netlify.app"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def _build_session()->requests.Session:
    s=requests.Session()
    retries=Retry(total=3, backoff_factor=0.6,
                  status_forcelist=[429,500,502,503,504],
                  allowed_methods=["GET","HEAD","OPTIONS"],
                  raise_on_status=False)
    s.mount("https://", HTTPAdapter(max_retries=retries))
    s.mount("http://",  HTTPAdapter(max_retries=retries))
    return s

HTTP=_build_session()

def _ig_headers()->Dict[str,str]:
    return {
        "User-Agent":("Mozilla/5.0 (Linux; Android 13; Pixel 7) "
                      "AppleWebKit/537.36 (KHTML, like Gecko) "
                      "Chrome/124.0.0.0 Mobile Safari/537.36"),
        "x-ig-app-id":"936619743392459",
        "Accept":"application/json, text/plain, */*",
        "Referer":"https://www.instagram.com/",
    }

_PROFILE_CACHE: Dict[str, Any] = {}
_PROFILE_TTL = 60*15
_now=time.time
def _cache_get(u:str):
    key=u.lower(); v=_PROFILE_CACHE.get(key)
    if not v: return None
    exp,data=v
    if _now()<exp: return data
    _PROFILE_CACHE.pop(key,None); return None
def _cache_set(u:str,data:Dict[str,Any]):
    _PROFILE_CACHE[u.lower()]=(_now()+_PROFILE_TTL,data)

_RE_FOLLOWERS=re.compile(r'"edge_followed_by"\s*:\s*{\s*"count"\s*:\s*(\d+)')
_RE_FOLLOWING=re.compile(r'"edge_follow"\s*:\s*{\s*"count"\s*:\s*(\d+)')
_RE_MEDIA    =re.compile(r'"edge_owner_to_timeline_media"\s*:\s*{\s*"count"\s*:\s*(\d+)')
_RE_BIO      =re.compile(r'"biography"\s*:\s*"((?:\\.|[^"\\])*)"')
_RE_VERIFIED =re.compile(r'"is_verified"\s*:\s*(true|false)')
_RE_FULLNAME =re.compile(r'"full_name"\s*:\s*"((?:\\.|[^"\\])*)"')
_RE_PIC_HD   =re.compile(r'"profile_pic_url_hd"\s*:\s*"([^"]+)"')
_RE_PIC      =re.compile(r'"profile_pic_url"\s*:\s*"([^"]+)"')

def _num(x):
    try: return int(x)
    except:
        try: return int(float(x))
        except: return None

def _unesc(s:str)->str:
    try: return bytes(s,"utf-8").decode("unicode_escape")
    except: return s

def _scrape(username:str):
    url=f"https://www.instagram.com/{username}/"
    try:
        r=HTTP.get(url, headers=_ig_headers(), timeout=8)
        if r.status_code!=200 or not r.text: return None
        html=r.text
        return {
            "username": username,
            "full_name": _unesc(_RE_FULLNAME.search(html).group(1)) if _RE_FULLNAME.search(html) else username,
            "biography": _unesc(_RE_BIO.search(html).group(1)) if _RE_BIO.search(html) else "",
            "is_verified": (_RE_VERIFIED.search(html).group(1)=="true") if _RE_VERIFIED.search(html) else False,
            "follower_count": _num(_RE_FOLLOWERS.search(html).group(1)) if _RE_FOLLOWERS.search(html) else None,
            "following_count": _num(_RE_FOLLOWING.search(html).group(1)) if _RE_FOLLOWING.search(html) else None,
            "media_count": _num(_RE_MEDIA.search(html).group(1)) if _RE_MEDIA.search(html) else None,
            "profile_pic_url": _RE_PIC.search(html).group(1) if _RE_PIC.search(html) else None,
            "profile_pic_url_hd": _RE_PIC_HD.search(html).group(1) if _RE_PIC_HD.search(html) else None,
        }
    except:
        return None

def _api(username:str):
    api=f"https://i.instagram.com/api/v1/users/web_profile_info/?username={username}"
    try:
        r=HTTP.get(api, headers=_ig_headers(), timeout=8)
        if r.status_code!=200: return None
        data=r.json()
        u=(data.get("data") or {}).get("user") or {}
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
    except:
        return None

@app.get("/health")
def health():
    return {"status":"ok","service":"krave","version":app.version}

@app.get("/buscar-usuario")
def buscar_usuario(username: str = Query(...)):
    if not username:
        return JSONResponse({"error":"username requerido"}, status_code=400)
    if username.lower()=="cadillaccf1":
        username="cadillacf1"
    cached=_cache_get(username)
    if cached: return {"usuario": cached}
    data=_api(username) or _scrape(username)
    if not data:
        data={
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
def avatar(username: str = Query(...)):
    if not username: return Response(status_code=400)
    if username.lower()=="cadillaccf1":
        username="cadillacf1"
    for getter in (_api,_scrape):
        try:
            info=getter(username)
            pic=(info or {}).get("profile_pic_url_hd") or (info or {}).get("profile_pic_url")
            if pic:
                ir=HTTP.get(pic, headers=_ig_headers(), timeout=8)
                if ir.status_code==200 and ir.content:
                    ctype=ir.headers.get("Content-Type","image/jpeg")
                    return Response(ir.content, media_type=ctype, headers={"Cache-Control":"public, max-age=21600"})
        except: pass
    try:
        ua=f"https://unavatar.io/instagram/{username}"
        ur=HTTP.get(ua, timeout=8)
        if ur.status_code==200 and ur.content:
            ctype=ur.headers.get("Content-Type","image/png")
            return Response(ur.content, media_type=ctype, headers={"Cache-Control":"public, max-age=21600"})
    except: pass
    return Response(status_code=204)