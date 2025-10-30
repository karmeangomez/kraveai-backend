# main.py
# Backend para KraveAI (FastAPI)
# Endpoints: /health, /avatar, /buscar-usuario, /refresh-clients, /purge-cache, /youtube/ordenar-vistas

from fastapi import FastAPI, HTTPException, Query, Header, BackgroundTasks
from fastapi.responses import RedirectResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel, Field
from typing import Dict, List, Optional
import time, os, threading, random, json, logging
from datetime import datetime

# === Selenium (solo si está disponible) ===
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
    logging.warning("Selenium no instalado. Usa: pip install selenium webdriver-manager")

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

# ===== YouTube Jobs Cache =====
class ThreadSafeCache:
    def __init__(self):
        self.store: Dict[str, Dict] = {}
        self.lock = threading.Lock()

    def get(self, key: str):
        with self.lock:
            return self.store.get(key)

    def set(self, key: str, value: dict):
        with self.lock:
            self.store[key] = value

    def delete(self, key: str):
        with self.lock:
            self.store.pop(key, None)

youtube_jobs_cache = ThreadSafeCache()

def json_cached(payload: dict, max_age: int = 0) -> JSONResponse:
    resp = JSONResponse(payload)
    resp.headers["Cache-Control"] = f"public, max-age={max_age}" if max_age > 0 else "no-store"
    return resp

# ===== YouTube Bot REAL =====
class YouTubeBot:
    def __init__(self, video_url: str, views_count: int, min_duration: int, max_duration: int, job_id: str, use_proxies: bool):
        self.video_url = self._normalize_url(video_url)
        self.views_count = views_count
        self.min_duration = min_duration
        self.max_duration = max_duration
        self.job_id = job_id
        self.use_proxies = use_proxies
        self.proxies = self._load_proxies() if use_proxies else []
        self.successful = 0
        self.failed = 0

    def _normalize_url(self, url: str) -> str:
        if "youtube.com" in url:
            return url.split("&")[0]
        elif "youtu.be" in url:
            return f"https://www.youtube.com/watch?v={url.split('/')[-1].split('?')[0]}"
        raise ValueError("URL no válida")

    def _load_proxies(self) -> List[dict]:
        paths = ["proxies.json", "proxies/proxies.json", "/app/proxies.json"]
        for path in paths:
            if os.path.exists(path):
                try:
                    with open(path, 'r') as f:
                        data = json.load(f)
                        proxies = data if isinstance(data, list) else data.get("proxies", [])
                        return [p for p in proxies if isinstance(p, dict) and p.get("ip") and p.get("port")]
                except Exception as e:
                    logging.warning(f"Error cargando proxies: {e}")
        return []

    def _setup_driver(self, proxy: Optional[dict] = None):
        if not SELENIUM_AVAILABLE:
            raise RuntimeError("Selenium no disponible")

        options = Options()
        options.add_argument('--headless=new')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--disable-gpu')
        options.add_argument('--disable-blink-features=AutomationControlled')
        options.add_experimental_option("excludeSwitches", ["enable-automation"])
        options.add_experimental_option('useAutomationExtension', False)

        # User-agent móvil
        uas = [
            "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
            "Mozilla/5.0 (Linux; Android 15; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36"
        ]
        options.add_argument(f'--user-agent={random.choice(uas)}')

        if proxy:
            proxy_str = f"{proxy['ip']}:{proxy['port']}"
            if proxy.get('username'):
                proxy_str = f"{proxy['username']}:{proxy['password']}@{proxy_str}"
            options.add_argument(f'--proxy-server=http://{proxy_str}')

        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=options)
        driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined});")
        return driver

    def _simulate_human(self, driver):
        try:
            for _ in range(random.randint(1, 3)):
                driver.execute_script(f"window.scrollBy(0, {random.randint(100, 400)});")
                time.sleep(random.uniform(1, 3))
        except:
            pass

    def _watch_video(self, view_num: int) -> bool:
        driver = None
        try:
            proxy = random.choice(self.proxies) if self.proxies else None
            driver = self._setup_driver(proxy)
            driver.get(self.video_url)

            WebDriverWait(driver, 20).until(
                EC.presence_of_element_located((By.TAG_NAME, "video"))
            )
            time.sleep(3)

            duration = random.randint(self.min_duration, self.max_duration)
            start = time.time()
            while time.time() - start < duration:
                if random.random() < 0.3:
                    self._simulate_human(driver)
                time.sleep(min(8, duration - (time.time() - start)))

            self.successful += 1
            return True
        except Exception as e:
            logging.error(f"View {view_num} falló: {e}")
            self.failed += 1
            return False
        finally:
            if driver:
                try: driver.quit()
                except: pass

    def _update_status(self, status: str, extra: dict = None):
        data = {
            'status': status,
            'completed_views': self.successful,
            'failed_views': self.failed,
            'total_views': self.views_count,
            'progress': f"{(self.successful + self.failed) / self.views_count * 100:.1f}%" if self.views_count > 0 else "0%",
            'success_rate': (self.successful / self.views_count * 100) if self.views_count > 0 else 0
        }
        if extra:
            data.update(extra)
        youtube_jobs_cache.set(self.job_id, data)

    def start_campaign(self):
        try:
            self._update_status('running', {'start_time': datetime.now().isoformat()})
            logging.info(f"Bot iniciado: {self.job_id} | {self.views_count} vistas")

            for i in range(self.views_count):
                success = self._watch_video(i + 1)
                if (i + 1) % 10 == 0:
                    self._update_status('running')

                if i < self.views_count - 1:
                    time.sleep(random.uniform(3, 10))

            self._update_status('completed', {'end_time': datetime.now().isoformat()})
            logging.info(f"Bot completado: {self.successful}/{self.views_count} vistas")

        except Exception as e:
            self._update_status('failed', {'error': str(e)})
            logging.error(f"Bot falló: {e}")

def run_bot_task(video_url, views_count, min_duration, max_duration, job_id, use_proxies):
    if not SELENIUM_AVAILABLE:
        youtube_jobs_cache.set(job_id, {'status': 'failed', 'error': 'Selenium no instalado'})
        return
    bot = YouTubeBot(video_url, views_count, min_duration, max_duration, job_id, use_proxies)
    bot.start_campaign()

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
def health(): 
    return {
        "status": "ok", 
        "name": APP_NAME, 
        "version": VERSION,
        "youtube_bot": "integrated",
        "selenium_available": SELENIUM_AVAILABLE
    }

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

# ===== RUTA YOUTUBE MEJORADA =====
@app.post("/youtube/ordenar-vistas", response_model=YouTubeOrderResponse)
async def ordenar_vistas_youtube(order: YouTubeOrder, background_tasks: BackgroundTasks):
    """Endpoint REAL para ordenar vistas de YouTube usando Selenium"""
    try:
        video_url = order.video_url.strip()
        cantidad = order.cantidad
        
        if not video_url or not cantidad:
            raise HTTPException(status_code=400, detail="URL y cantidad requeridos")
        
        if not any(domain in video_url for domain in ['youtu.be', 'youtube.com']):
            raise HTTPException(status_code=400, detail="URL de YouTube no válida")
        
        if cantidad > 1000:
            raise HTTPException(status_code=400, detail="Máximo 1000 vistas por orden")
        if cantidad < 10:
            raise HTTPException(status_code=400, detail="Mínimo 10 vistas por orden")
        
        if not SELENIUM_AVAILABLE:
            raise HTTPException(status_code=503, detail="Servicio YouTube temporalmente no disponible")
        
        # Crear job ID
        job_id = f"yt_{int(time.time())}_{random.randint(1000, 9999)}"
        
        # Inicializar en cache
        youtube_jobs_cache.set(job_id, {
            'status': 'queued',
            'video_url': video_url,
            'total_views': cantidad,
            'completed_views': 0,
            'failed_views': 0,
            'progress': '0%'
        })
        
        # Ejecutar en segundo plano
        background_tasks.add_task(
            run_bot_task,
            video_url,
            cantidad,
            30,  # min_duration
            120, # max_duration  
            job_id,
            False  # use_proxies
        )
        
        return YouTubeOrderResponse(
            success=True,
            message=f"✅ {cantidad} vistas ordenadas para YouTube. Job ID: {job_id}",
            order_id=job_id
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")

# ===== NUEVO ENDPOINT PARA VER ESTADO =====
@app.get("/youtube/estado/{job_id}")
def youtube_estado_job(job_id: str):
    """Ver estado de un trabajo de YouTube"""
    data = youtube_jobs_cache.get(job_id)
    if not data:
        raise HTTPException(404, "Trabajo no encontrado")
    return data

@app.get("/youtube/health")
def youtube_health():
    """Salud específica del servicio YouTube"""
    return {
        "status": "ok",
        "service": "YouTube Bot",
        "selenium": SELENIUM_AVAILABLE,
        "active_jobs": len([k for k in youtube_jobs_cache.store.keys() if k.startswith("yt_")])
    }

@app.get("/")
def root(): 
    return {
        "ok": True, 
        "service": APP_NAME, 
        "docs": "/docs",
        "endpoints": [
            "/health", 
            "/avatar", 
            "/buscar-usuario", 
            "/refresh-clients",
            "/youtube/ordenar-vistas",
            "/youtube/estado/{job_id}",
            "/youtube/health"
        ]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
