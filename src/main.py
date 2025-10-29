# main.py
# Backend para KraveAI (FastAPI) - Con YouTube Views
# Endpoints: /health, /avatar, /buscar-usuario, /refresh-clients, /purge-cache, /youtube-views

from fastapi import FastAPI, HTTPException, Query, Header, BackgroundTasks
from fastapi.responses import RedirectResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel, Field
from typing import Dict, List, Optional
import time, os, json, random, threading
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

APP_NAME = "KraveAI API"
VERSION = "1.0.4"  # Incrementamos versión
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

class RefreshResp(BaseModel):
    usuarios: Dict[str, UserInfo] = {}

# Nuevo modelo para YouTube Views
class YouTubeViewsRequest(BaseModel):
    video_url: str
    views_count: int = Field(100, ge=10, le=10000)
    min_duration: int = Field(30, ge=10, le=300)
    max_duration: int = Field(180, ge=30, le=600)

class YouTubeViewsResponse(BaseModel):
    status: str
    message: str
    video_url: str
    job_id: Optional[str] = None

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

# Cache para trabajos de YouTube
youtube_jobs_cache = TTLCache(3600)  # 1 hora

def json_cached(payload: dict, max_age: int = 0) -> JSONResponse:
    resp = JSONResponse(payload)
    resp.headers["Cache-Control"] = f"public, max-age={max_age}" if max_age > 0 else "no-store"
    return resp

# ===== YouTube Views Bot =====
class YouTubeViewBot:
    def __init__(self, video_url: str, views_count: int, min_duration: int, max_duration: int):
        self.video_url = video_url
        self.views_count = views_count
        self.min_duration = min_duration
        self.max_duration = max_duration
        self.proxies = self.load_proxies()
        self.job_id = f"yt_{int(time.time())}_{random.randint(1000, 9999)}"
        
    def load_proxies(self):
        """Cargar proxies desde el sistema existente"""
        try:
            # Intenta cargar desde tu estructura de proxies
            with open('proxies/proxies.json', 'r') as f:
                return json.load(f)
        except:
            try:
                # Fallback a proxies básicos
                with open('proxies.json', 'r') as f:
                    return json.load(f)
            except:
                return []
    
    def get_random_proxy(self):
        """Obtener proxy aleatorio"""
        if self.proxies and len(self.proxies) > 0:
            return random.choice(self.proxies)
        return None
    
    def simulate_human_behavior(self, driver):
        """Simular comportamiento humano"""
        try:
            # Scroll aleatorio
            for _ in range(random.randint(2, 4)):
                scroll_pixels = random.randint(200, 600)
                driver.execute_script(f"window.scrollBy(0, {scroll_pixels});")
                time.sleep(random.uniform(1, 3))
                
            # Pequeños movimientos de mouse
            actions = webdriver.ActionChains(driver)
            for _ in range(random.randint(2, 5)):
                x_offset = random.randint(-50, 50)
                y_offset = random.randint(-50, 50)
                actions.move_by_offset(x_offset, y_offset)
                actions.perform()
                time.sleep(0.5)
        except:
            pass
    
    def setup_driver(self, proxy_data=None):
        """Configurar Chrome driver con opciones anti-detección"""
        chrome_options = webdriver.ChromeOptions()
        
        # Configuración anti-detección
        chrome_options.add_argument('--disable-blink-features=AutomationControlled')
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        
        # User-agent móvil aleatorio
        mobile_user_agents = [
            "Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1",
            "Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Mobile Safari/537.36",
            "Mozilla/5.0 (iPad; CPU OS 14_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1",
            "Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36"
        ]
        chrome_options.add_argument(f'--user-agent={random.choice(mobile_user_agents)}')
        
        # Proxy si está disponible
        if proxy_data and isinstance(proxy_data, dict):
            try:
                proxy_str = f"http://{proxy_data.get('username', '')}:{proxy_data.get('password', '')}@{proxy_data.get('ip')}:{proxy_data.get('port')}"
                chrome_options.add_argument(f'--proxy-server={proxy_str}')
            except:
                pass
        
        driver = webdriver.Chrome(options=chrome_options)
        driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        return driver
    
    def watch_video(self, view_number: int):
        """Ver un video individual"""
        driver = None
        try:
            proxy = self.get_random_proxy()
            driver = self.setup_driver(proxy)
            
            # Navegar al video
            driver.get(self.video_url)
            
            # Esperar a que cargue el video
            WebDriverWait(driver, 15).until(
                EC.presence_of_element_located((By.TAG_NAME, "video"))
            )
            
            # Reproducir video si está pausado
            video_element = driver.find_element(By.TAG_NAME, "video")
            if video_element.get_attribute("paused") is not None:
                driver.execute_script("arguments[0].play();", video_element)
            
            # Tiempo de visualización aleatorio
            view_duration = random.randint(self.min_duration, self.max_duration)
            start_time = time.time()
            
            # Comportamiento humano durante la reproducción
            while time.time() - start_time < view_duration:
                self.simulate_human_behavior(driver)
                remaining = view_duration - (time.time() - start_time)
                if remaining > 0:
                    time.sleep(min(8, remaining))
            
            # Actualizar estadísticas
            current_stats = youtube_jobs_cache.get(self.job_id) or {
                'completed_views': 0,
                'total_views': self.views_count,
                'status': 'running'
            }
            current_stats['completed_views'] += 1
            youtube_jobs_cache.set(self.job_id, current_stats)
            
            return True
            
        except Exception as e:
            print(f"Error en view {view_number}: {e}")
            return False
        finally:
            if driver:
                try:
                    driver.quit()
                except:
                    pass
    
    def start_campaign(self):
        """Iniciar campaña en segundo plano"""
        successful_views = 0
        
        # Inicializar estadísticas del trabajo
        youtube_jobs_cache.set(self.job_id, {
            'completed_views': 0,
            'total_views': self.views_count,
            'status': 'running',
            'start_time': time.time()
        })
        
        for i in range(self.views_count):
            success = self.watch_video(i + 1)
            if success:
                successful_views += 1
            
            # Delay entre views
            if i < self.views_count - 1:
                time.sleep(random.uniform(5, 15))
        
        # Marcar como completado
        final_stats = {
            'completed_views': successful_views,
            'total_views': self.views_count,
            'status': 'completed',
            'success_rate': (successful_views / self.views_count) * 100,
            'end_time': time.time()
        }
        youtube_jobs_cache.set(self.job_id, final_stats)
        
        print(f"YouTube campaign completed: {successful_views}/{self.views_count} views")

def run_youtube_bot(video_url: str, views_count: int, min_duration: int, max_duration: int):
    """Función para ejecutar el bot en segundo plano"""
    bot = YouTubeViewBot(video_url, views_count, min_duration, max_duration)
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
    """Agrega la URL interna de avatar al perfil"""
    d = u.dict()
    d["profile_pic_url"] = f"/avatar?username={u.username}"
    return d

# ===== Rutas Existente =====
@app.get("/health")
def health(): return {"status": "ok", "name": APP_NAME, "version": VERSION}

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

# ===== Nuevas Rutas YouTube =====
@app.post("/youtube-views", response_model=YouTubeViewsResponse)
def youtube_views(request: YouTubeViewsRequest, background_tasks: BackgroundTasks):
    """Iniciar campaña de visualizaciones de YouTube"""
    try:
        # Validar URL de YouTube
        if "youtube.com" not in request.video_url and "youtu.be" not in request.video_url:
            raise HTTPException(status_code=400, detail="URL de YouTube no válida")
        
        # Crear bot y obtener job_id
        bot = YouTubeViewBot(
            request.video_url, 
            request.views_count, 
            request.min_duration, 
            request.max_duration
        )
        
        # Ejecutar en segundo plano
        background_tasks.add_task(
            run_youtube_bot,
            request.video_url,
            request.views_count,
            request.min_duration,
            request.max_duration
        )
        
        return YouTubeViewsResponse(
            status="started",
            message=f"Campaña de {request.views_count} vistas iniciada",
            video_url=request.video_url,
            job_id=bot.job_id
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")

@app.get("/youtube-job-status/{job_id}")
def youtube_job_status(job_id: str):
    """Obtener estado de un trabajo de YouTube"""
    job_data = youtube_jobs_cache.get(job_id)
    if not job_data:
        raise HTTPException(status_code=404, detail="Trabajo no encontrado")
    
    return {
        "job_id": job_id,
        "status": job_data.get("status", "unknown"),
        "progress": f"{job_data.get('completed_views', 0)}/{job_data.get('total_views', 0)}",
        "success_rate": job_data.get("success_rate", 0),
        "completed_views": job_data.get("completed_views", 0),
        "total_views": job_data.get("total_views", 0)
    }

@app.get("/youtube-services")
def youtube_services():
    """Información de servicios de YouTube disponibles"""
    return {
        "services": [
            {
                "name": "Vistas YouTube",
                "key": "youtube_views",
                "description": "Aumenta vistas de videos con proxies rotativos",
                "min_views": 10,
                "max_views": 10000,
                "features": ["Proxies rotativos", "Comportamiento humano", "Tiempos configurables"]
            }
        ]
    }

@app.get("/")
def root(): 
    return {
        "ok": True, 
        "service": APP_NAME, 
        "version": VERSION,
        "endpoints": {
            "docs": "/docs",
            "health": "/health", 
            "youtube_views": "/youtube-views",
            "youtube_services": "/youtube-services"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
