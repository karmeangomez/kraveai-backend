# main.py
# Backend para KraveAI (FastAPI) - VERSIÓN MEJORADA Y FUNCIONAL 2026
# Con extracción real vía Selenium para perfiles de Instagram

from fastapi import FastAPI, HTTPException, Query, Header, BackgroundTasks
from fastapi.responses import RedirectResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel
from typing import Dict, List, Optional
import time, os, threading, random, logging
from datetime import datetime
from urllib.parse import urlparse
import requests

# Selenium
try:
    from selenium import webdriver
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.chrome.service import Service
    from selenium.webdriver.chrome.options import Options
    from webdriver_manager.chrome import ChromeDriverManager
    SELENIUM_AVAILABLE = True
except ImportError:
    SELENIUM_AVAILABLE = False
    logging.warning("Selenium no instalado. Instala con: pip install selenium webdriver-manager")

APP_NAME = "KraveAI API"
VERSION = "1.0.6"  # Actualizada
CACHE_TTL_SECONDS = int(os.getenv("KRAVE_CACHE_TTL", "1800"))      # 30 min
PROFILE_MAX_AGE = int(os.getenv("KRAVE_PROFILE_MAX_AGE", "300"))    # 5 min
AVATAR_MAX_AGE = int(os.getenv("KRAVE_AVATAR_MAX_AGE", "86400"))   # 24 h
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

# Modelos
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

# Cache
class TTLCache:
    def __init__(self, ttl_seconds: int):
        self.ttl = ttl_seconds
        self.store: Dict[str, Dict] = {}
    def get(self, key: str):
        row = self.store.get(key)
        if not row: return None
        if (time.time() - row["t"]) > self.ttl:
            self.store.pop(key, None)
            return None
        return row["data"]
    def set(self, key: str, value):
        self.store[key] = {"t": time.time(), "data": value}
    def clear(self): self.store.clear()

profile_cache = TTLCache(CACHE_TTL_SECONDS)

class ThreadSafeCache:
    def __init__(self):
        self.store: Dict[str, Dict] = {}
        self.lock = threading.Lock()
    def get(self, key: str):
        with self.lock: return self.store.get(key)
    def set(self, key: str, value: dict):
        with self.lock: self.store[key] = value
    def delete(self, key: str):
        with self.lock: self.store.pop(key, None)

youtube_jobs_cache = ThreadSafeCache()

def json_cached(payload: dict, max_age: int = 0) -> JSONResponse:
    resp = JSONResponse(payload)
    resp.headers["Cache-Control"] = f"public, max-age={max_age}" if max_age > 0 else "no-store"
    return resp

# URLs acortadas y YouTube normalización (sin cambios)
DOMINIOS_ACORTADOS = {'t.co', 'bit.ly', 'goo.gl', 'tinyurl.com', 'ow.ly', 'buff.ly',
                      'fb.me', 'is.gd', 'v.gd', 'mcaf.ee', 'spoti.fi', 'apple.co', 'amzn.to'}

def resolver_url_acortada(url: str, timeout: int = 10) -> str:
    try:
        if 'youtube.com' in url or 'youtu.be' in url:
            return url
        response = requests.head(url, allow_redirects=True, timeout=timeout,
                                 headers={'User-Agent': 'Mozilla/5.0'})
        url_final = response.url
        if 'youtube.com' in url_final or 'youtu.be' in url_final:
            return url_final
        raise ValueError(f"No es YouTube: {url_final}")
    except Exception as e:
        raise ValueError(f"Error resolviendo URL: {str(e)}")

def validar_y_normalizar_url_youtube(url: str) -> str:
    url = url.strip()
    dominio = urlparse(url).netloc.lower()
    if dominio in DOMINIOS_ACORTADOS:
        url = resolver_url_acortada(url)
    # ... (resto igual al original)
    if 'youtube.com/watch?v=' in url:
        video_id = url.split('v=')[1].split('&')[0]
        if len(video_id) >= 10:
            return f"https://www.youtube.com/watch?v={video_id}"
    elif 'youtu.be/' in url:
        video_id = url.split('youtu.be/')[1].split('?')[0]
        if len(video_id) >= 10:
            return f"https://www.youtube.com/watch?v={video_id}"
    elif 'youtube.com/shorts/' in url:
        video_id = url.split('/shorts/')[1].split('?')[0]
        if len(video_id) >= 10:
            return f"https://www.youtube.com/watch?v={video_id}"
    raise ValueError("URL no válida de YouTube")

# YouTube bot simple (sin cambios)
def run_youtube_bot_simple(video_url: str, cantidad: int, job_id: str):
    # ... (código original sin cambios)

# Seed (sin cambios)
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

# ────────────────────────────────────────────────
# FUNCIÓN PRINCIPAL: Extracción real con Selenium
# ────────────────────────────────────────────────
def get_instagram_profile_data(username: str) -> dict | None:
    if not SELENIUM_AVAILABLE:
        logging.error("Selenium no disponible")
        return None

    u = username.strip().lstrip("@").lower()
    if not u:
        return None

    try:
        options = Options()
        options.add_argument("--headless=new")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")
        options.add_argument(f"user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36")

        driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
        driver.set_page_load_timeout(30)
        driver.get(f"https://www.instagram.com/{u}/")

        wait = WebDriverWait(driver, 20)

        # Esperamos que cargue el perfil
        wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "header section")))

        data = {}

        # Foto de perfil
        try:
            img = wait.until(EC.presence_of_element_located(
                (By.CSS_SELECTOR, 'img[alt*="profile picture"], img[alt*="Foto de perfil"]')
            ))
            data["profile_pic_url"] = img.get_attribute("src")
        except:
            data["profile_pic_url"] = ""

        # Nombre completo
        try:
            h2 = driver.find_element(By.CSS_SELECTOR, "h2.x1lliihq")
            data["full_name"] = h2.text.strip()
        except:
            data["full_name"] = u.capitalize()

        # Biografía
        try:
            bio = driver.find_element(By.CSS_SELECTOR, "div._a9zs span, h1._aacl._aaco._aacu._aacx._aad6._aade")
            data["biography"] = bio.text.strip()
        except:
            data["biography"] = ""

        # Verificado
        data["is_verified"] = bool(driver.find_elements(By.CSS_SELECTOR, 'span[aria-label*="Verified"], svg[aria-label="Verified"]'))

        # Estadísticas: posts, followers, following
        try:
            lis = driver.find_elements(By.CSS_SELECTOR, "ul.x78zum5.x1q0g3np li")
            if len(lis) >= 3:
                # Posts
                data["media_count"] = int(lis[0].find_element(By.TAG_NAME, "span").get_attribute("title") or "0".replace(",", ""))
                # Seguidores
                followers_span = lis[1].find_element(By.TAG_NAME, "span")
                data["follower_count"] = int(followers_span.get_attribute("title") or followers_span.text.replace(",", "").replace("M", "000000").replace("K", "000"))
                # Seguidos
                data["following_count"] = int(lis[2].find_element(By.TAG_NAME, "span").get_attribute("title") or "0".replace(",", ""))
        except:
            data["media_count"] = 0
            data["follower_count"] = 0
            data["following_count"] = 0

        driver.quit()
        logging.info(f"Perfil extraído OK: @{u} → {data.get('follower_count', 0)} followers")
        return data

    except Exception as e:
        logging.error(f"Error extrayendo @{u} con Selenium: {str(e)}")
        if 'driver' in locals():
            driver.quit()
        return None

# Rutas
@app.get("/health")
def health():
    return {
        "status": "ok",
        "name": APP_NAME,
        "version": VERSION,
        "selenium_available": SELENIUM_AVAILABLE,
        "timestamp": datetime.now().isoformat()
    }

@app.get("/avatar")
def avatar(username: str = Query(...)):
    real_data = get_instagram_profile_data(username)
    if real_data and real_data.get("profile_pic_url"):
        resp = RedirectResponse(url=real_data["profile_pic_url"], status_code=302)
        resp.headers["Cache-Control"] = f"public, max-age={AVATAR_MAX_AGE}"
        return resp

    # Fallback
    providers = [
        f"https://ui-avatars.com/api/?name={username}&background=random&size=512",
        f"https://avatars.dicebear.com/api/initials/{username}.svg",
    ]
    resp = RedirectResponse(url=providers[0], status_code=302)
    resp.headers["Cache-Control"] = f"public, max-age={AVATAR_MAX_AGE}"
    return resp

@app.get("/buscar-usuario")
def buscar_usuario(username: str = Query(...)):
    u = username.strip().lstrip("@").lower()
    cached = profile_cache.get(f"user:{u}")
    if cached:
        return json_cached({"usuario": cached}, PROFILE_MAX_AGE)

    real_data = get_instagram_profile_data(u)
    if real_data:
        info = UserInfo(
            username=u,
            full_name=real_data.get("full_name"),
            follower_count=real_data.get("follower_count"),
            following_count=real_data.get("following_count"),
            media_count=real_data.get("media_count"),
            biography=real_data.get("biography"),
            is_verified=real_data.get("is_verified"),
            profile_pic_url=real_data.get("profile_pic_url")
        )
    else:
        info = seed_or_stub(u)

    payload = info.dict()
    if not payload.get("profile_pic_url"):
        payload["profile_pic_url"] = f"/avatar?username={u}"

    profile_cache.set(f"user:{u}", payload)
    return json_cached({"usuario": payload}, PROFILE_MAX_AGE)

@app.post("/refresh-clients", response_model=RefreshResp)
def refresh_clients(req: RefreshReq):
    if not req.users:
        raise HTTPException(400, "Falta lista de usuarios")

    result = {}
    for raw_u in req.users:
        u = (raw_u or "").strip().lstrip("@").lower()
        if not u: continue

        cached = profile_cache.get(f"user:{u}")
        if cached:
            result[u] = UserInfo(**cached)
            continue

        real_data = get_instagram_profile_data(u)
        if real_data:
            info = UserInfo(
                username=u,
                full_name=real_data.get("full_name"),
                follower_count=real_data.get("follower_count"),
                following_count=real_data.get("following_count"),
                media_count=real_data.get("media_count"),
                biography=real_data.get("biography"),
                is_verified=real_data.get("is_verified"),
            )
            payload = info.dict()
            payload["profile_pic_url"] = real_data.get("profile_pic_url") or f"/avatar?username={u}"
        else:
            info = seed_or_stub(u)
            payload = with_avatar(info)

        profile_cache.set(f"user:{u}", payload)
        result[u] = UserInfo(**payload)

    resp = JSONResponse({"usuarios": {k: v.dict() for k,v in result.items()}})
    resp.headers["Cache-Control"] = f"public, max-age={PROFILE_MAX_AGE}"
    return resp

# Resto del código (purge-cache, YouTube endpoints, root) se mantiene exactamente igual al original

# ... (pega aquí el resto del código original que no modifiqué: purge-cache, youtube endpoints, root, if __name__ == "__main__")
