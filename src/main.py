# Backend para KraveAI (FastAPI) - Con YouTube Views Bot Corregido
# Endpoints: /health, /avatar, /buscar-usuario, /refresh-clients, /purge-cache, /youtube-views
from fastapi import FastAPI, HTTPException, Query, Header, BackgroundTasks
from fastapi.responses import RedirectResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel, Field
from typing import Dict, List, Optional
import time, os, json, random, threading, logging
from datetime import datetime
import uvicorn

# Selenium y dependencias
try:
    from selenium import webdriver
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.chrome.service import Service
    from selenium.webdriver.chrome.options import Options
    from webdriver_manager.chrome import ChromeDriverManager
    from fake_useragent import UserAgent
    SELENIUM_AVAILABLE = True
except ImportError:
    SELENIUM_AVAILABLE = False
    logging.warning("Selenium no disponible. Instala: pip install selenium webdriver-manager fake-useragent")

# Configuración de logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ===== Configuración =====
APP_NAME = "KraveAI API"
VERSION = "1.1.0"  # Versión corregida
CACHE_TTL_SECONDS = int(os.getenv("KRAVE_CACHE_TTL", "900"))
PROFILE_MAX_AGE = int(os.getenv("KRAVE_PROFILE_MAX_AGE", "60"))
AVATAR_MAX_AGE = int(os.getenv("KRAVE_AVATAR_MAX_AGE", "86400"))
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN")
MAX_CONCURRENT_VIEWS = int(os.getenv("MAX_CONCURRENT_VIEWS", "3"))
YOUTUBE_PROXY_FILE = os.getenv("YOUTUBE_PROXY_FILE", "proxies.json")

app = FastAPI(title=APP_NAME, version=VERSION)

# ===== Middleware =====
allowed_origins = os.getenv("ALLOWED_ORIGINS", "*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in allowed_origins.split(",")] if allowed_origins != "*" else ["*"],
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

class YouTubeViewsRequest(BaseModel):
    video_url: str = Field(..., description="URL de YouTube válida")
    views_count: int = Field(100, ge=10, le=5000, description="Número de vistas")
    min_duration: int = Field(30, ge=10, le=300, description="Duración mínima en segundos")
    max_duration: int = Field(180, ge=30, le=600, description="Duración máxima en segundos")
    use_proxies: bool = Field(True, description="Usar proxies rotativos")

class YouTubeViewsResponse(BaseModel):
    status: str
    message: str
    video_url: str
    job_id: Optional[str] = None
    estimated_completion: Optional[str] = None

class JobStatus(BaseModel):
    job_id: str
    status: str
    progress: str
    completed_views: int
    total_views: int
    success_rate: float
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None

# ===== Cache mejorado =====
class TTLCache:
    def __init__(self, ttl_seconds: int):
        self.ttl = ttl_seconds
        self.store: Dict[str, Dict] = {}
        self.lock = threading.Lock()

    def get(self, key: str):
        with self.lock:
            row = self.store.get(key)
            if not row:
                return None
            if (time.time() - row["t"]) > self.ttl:
                self.store.pop(key, None)
                return None
            return row["data"]

    def set(self, key: str, value):
        with self.lock:
            self.store[key] = {"t": time.time(), "data": value}

    def clear(self):
        with self.lock:
            self.store.clear()

    def delete(self, key: str):
        with self.lock:
            self.store.pop(key, None)

profile_cache = TTLCache(CACHE_TTL_SECONDS)
youtube_jobs_cache = TTLCache(86400)  # 24 horas para jobs de YouTube

def json_cached(payload: dict, max_age: int = 0) -> JSONResponse:
    resp = JSONResponse(payload)
    resp.headers["Cache-Control"] = f"public, max-age={max_age}" if max_age > 0 else "no-store"
    return resp

# ===== Semáforo para concurrencia =====
from threading import Semaphore
view_semaphore = Semaphore(MAX_CONCURRENT_VIEWS)

# ===== YouTube View Bot Corregido =====
class YouTubeViewBot:
    def __init__(self, video_url: str, views_count: int, min_duration: int, max_duration: int, job_id: str, use_proxies: bool = True):
        self.video_url = self.validate_youtube_url(video_url)
        self.views_count = views_count
        self.min_duration = min_duration
        self.max_duration = max_duration
        self.job_id = job_id
        self.use_proxies = use_proxies
        self.proxies = []
        self.ua = UserAgent()
        self.successful_views = 0
        self.failed_views = 0
        
        if self.use_proxies:
            self.proxies = self.load_proxies()
            logger.info(f"Cargados {len(self.proxies)} proxies para job {job_id}")

    def validate_youtube_url(self, url: str) -> str:
        """Valida y normaliza URL de YouTube"""
        if "youtube.com/watch?v=" in url:
            video_id = url.split("v=")[1].split("&")[0]
            return f"https://www.youtube.com/watch?v={video_id}"
        elif "youtu.be/" in url:
            video_id = url.split("youtu.be/")[1].split("?")[0]
            return f"https://www.youtube.com/watch?v={video_id}"
        else:
            raise ValueError("URL de YouTube no válida")
    
    def load_proxies(self) -> List[dict]:
        """Carga proxies desde múltiples ubicaciones posibles"""
        possible_paths = [
            YOUTUBE_PROXY_FILE,
            f"proxies/{YOUTUBE_PROXY_FILE}",
            "/app/proxies.json",
            "./proxies.json"
        ]
        
        for path in possible_paths:
            if os.path.exists(path):
                try:
                    with open(path, 'r') as f:
                        data = json.load(f)
                        if isinstance(data, list):
                            # Formato: [{"ip": "x.x.x.x", "port": 8080, "username": "...", "password": "..."}]
                            return [p for p in data if self.validate_proxy_format(p)]
                        elif isinstance(data, dict) and 'proxies' in data:
                            return [p for p in data['proxies'] if self.validate_proxy_format(p)]
                except Exception as e:
                    logger.warning(f"Error cargando proxies desde {path}: {e}")
                    continue
        
        # Crear archivo de ejemplo si no existe
        self.create_proxy_example()
        logger.warning("No se encontraron proxies válidos. Operando sin proxies.")
        return []

    def validate_proxy_format(self, proxy: dict) -> bool:
        """Valida formato de proxy"""
        required = ['ip', 'port']
        return all(k in proxy for k in required) and isinstance(proxy['ip'], str) and isinstance(proxy['port'], int)

    def create_proxy_example(self):
        """Crea archivo de ejemplo de proxies"""
        example_proxies = {
            "proxies": [
                {
                    "ip": "123.45.67.89",
                    "port": 8080,
                    "username": "your_username",
                    "password": "your_password"
                },
                {
                    "ip": "98.76.54.32",
                    "port": 3128
                }
            ]
        }
        
        os.makedirs("proxies", exist_ok=True)
        with open("proxies/proxies.json", "w") as f:
            json.dump(example_proxies, f, indent=2)
        logger.info("Creado ejemplo de proxies.json en ./proxies/")

    def get_random_proxy(self) -> Optional[dict]:
        """Obtiene proxy aleatorio funcional"""
        if not self.proxies:
            return None
        
        # Simple rotación básica (puedes mejorar con health-check)
        return random.choice(self.proxies)

    def setup_driver(self, proxy_data: Optional[dict] = None) -> webdriver.Chrome:
        """Configura Chrome driver con anti-detección avanzada"""
        chrome_options = Options()
        
        # Modo headless optimizado
        chrome_options.add_argument('--headless=new')  # Headless más reciente
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--disable-gpu')
        chrome_options.add_argument('--disable-extensions')
        chrome_options.add_argument('--disable-plugins')
        chrome_options.add_argument('--disable-images')  # Ahorra bandwidth
        
        # Anti-detección avanzada
        chrome_options.add_argument('--disable-blink-features=AutomationControlled')
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        chrome_options.add_argument('--disable-web-security')
        chrome_options.add_argument('--allow-running-insecure-content')
        
        # User-agents móviles realistas (2025)
        mobile_user_agents = [
            "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
            "Mozilla/5.0 (Linux; Android 15; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36",
            "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
            "Mozilla/5.0 (Linux; Android 14; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36",
            "Mozilla/5.0 (Windows Phone 10.0; Android 6.0.1; Microsoft; Lumia 950) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/52.0.2743.116 Mobile Safari/537.36 Edge/15.15063"
        ]
        chrome_options.add_argument(f'--user-agent={random.choice(mobile_user_agents)}')
        
        # Configuración de proxy
        if proxy_data:
            try:
                proxy_host = f"{proxy_data['ip']}:{proxy_data['port']}"
                if proxy_data.get('username') and proxy_data.get('password'):
                    proxy_host = f"{proxy_data['username']}:{proxy_data['password']}@{proxy_host}"
                chrome_options.add_argument(f'--proxy-server=http://{proxy_host}')
                logger.debug(f"Usando proxy: {proxy_data['ip']}:{proxy_data['port']}")
            except Exception as e:
                logger.warning(f"Error configurando proxy: {e}")
        
        # Configuración de ventana realista
        chrome_options.add_argument('--window-size=412,915')  # Tamaño móvil típico
        chrome_options.add_argument('--user-data-dir=/tmp/chrome-user-data')
        
        # Inicializar driver
        try:
            service = Service(ChromeDriverManager().install())
            driver = webdriver.Chrome(service=service, options=chrome_options)
            
            # Anti-detección final
            driver.execute_script("""
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined,
                });
                Object.defineProperty(navigator, 'plugins', {
                    get: () => [1, 2, 3, 4, 5],
                });
                Object.defineProperty(navigator, 'languages', {
                    get: () => ['en-US', 'en'],
                });
            """)
            
            # Configurar timeouts
            driver.set_page_load_timeout(30)
            driver.implicitly_wait(10)
            
            return driver
            
        except Exception as e:
            logger.error(f"Error creando driver: {e}")
            raise

    def simulate_human_behavior(self, driver: webdriver.Chrome):
        """Simula comportamiento humano más realista"""
        try:
            # Pausa inicial "pensando"
            time.sleep(random.uniform(1, 3))
            
            # Scroll natural (no lineal)
            scroll_actions = [
                ("down", random.randint(100, 300), random.uniform(1, 2)),
                ("up", random.randint(50, 150), random.uniform(0.5, 1)),
                ("down", random.randint(200, 500), random.uniform(2, 4))
            ]
            
            for direction, pixels, delay in random.sample(scroll_actions, k=random.randint(1, 3)):
                if direction == "up":
                    driver.execute_script(f"window.scrollBy(0, -{pixels});")
                else:
                    driver.execute_script(f"window.scrollBy(0, {pixels});")
                time.sleep(delay)
            
            # Interacción con elementos (si existen)
            try:
                # Buscar elementos interactivos comunes en YouTube
                selectors = [
                    ".ytp-play-button",  # Botón play
                    ".ytp-settings-button",  # Settings
                    "ytd-watch-metadata",  # Info del video
                    ".ytp-volume-slider"  # Volumen
                ]
                
                for selector in selectors:
                    try:
                        element = driver.find_element(By.CSS_SELECTOR, selector)
                        if element.is_displayed():
                            # Mover mouse al elemento
                            webdriver.ActionChains(driver).move_to_element(element).perform()
                            time.sleep(random.uniform(0.5, 1.5))
                            break
                    except:
                        continue
                        
            except Exception:
                pass
            
            # Pausa final aleatoria
            time.sleep(random.uniform(2, 5))
            
        except Exception as e:
            logger.debug(f"Error en simulación humana: {e}")

    def watch_video(self, view_number: int) -> bool:
        """Ejecuta una sola visualización"""
        driver = None
        try:
            # Obtener proxy si está disponible
            proxy_data = self.get_random_proxy() if self.use_proxies else None
            
            # Configurar driver
            driver = self.setup_driver(proxy_data)
            
            # Navegar al video
            logger.debug(f"Iniciando vista {view_number}/{self.views_count} - Job: {self.job_id}")
            driver.get(self.video_url)
            
            # Esperar carga del reproductor
            try:
                WebDriverWait(driver, 20).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, "video"))
                )
                time.sleep(random.uniform(2, 5))  # Espera adicional para buffer
            except Exception as e:
                logger.warning(f"Timeout esperando video en vista {view_number}: {e}")
                return False
            
            # Reproducir si está pausado
            try:
                video_element = driver.find_element(By.TAG_NAME, "video")
                if video_element.get_attribute("paused") == "true":
                    driver.execute_script("arguments[0].play();", video_element)
                    time.sleep(2)  # Espera reproducción
            except:
                pass
            
            # Duración de visualización aleatoria
            view_duration = random.randint(self.min_duration, self.max_duration)
            start_time = time.time()
            
            logger.debug(f"Vista {view_number}: Duración {view_duration}s")
            
            # Mantener reproducción durante el tiempo requerido
            while time.time() - start_time < view_duration:
                # Simular comportamiento humano periódicamente
                if random.random() < 0.3:  # 30% de probabilidad cada iteración
                    self.simulate_human_behavior(driver)
                
                # Pausa entre acciones
                remaining = view_duration - (time.time() - start_time)
                if remaining > 0:
                    sleep_time = min(10, remaining)
                    time.sleep(sleep_time)
            
            # Éxito
            self.successful_views += 1
            logger.info(f"✓ Vista {view_number} completada exitosamente")
            return True
            
        except Exception as e:
            self.failed_views += 1
            logger.error(f"✗ Vista {view_number} falló: {str(e)[:100]}")
            return False
        
        finally:
            # Cleanup del driver
            if driver:
                try:
                    driver.quit()
                except Exception:
                    pass

    def update_job_status(self, status: str, extra_data: dict = None):
        """Actualiza el estado del job en cache"""
        try:
            current = youtube_jobs_cache.get(self.job_id) or {}
            current.update({
                'status': status,
                'completed_views': self.successful_views,
                'failed_views': self.failed_views,
                'total_views': self.views_count,
                'success_rate': (self.successful_views / self.views_count * 100) if self.views_count > 0 else 0
            })
            
            if extra_data:
                current.update(extra_data)
            
            if status == 'completed':
                current['end_time'] = datetime.now().isoformat()
            
            youtube_jobs_cache.set(self.job_id, current)
            logger.debug(f"Estado actualizado para {self.job_id}: {status}")
            
        except Exception as e:
            logger.error(f"Error actualizando estado de job {self.job_id}: {e}")

    def start_campaign(self):
        """Inicia la campaña de visualizaciones"""
        try:
            # Estado inicial
            self.update_job_status('running', {
                'start_time': datetime.now().isoformat(),
                'progress': '0%'
            })
            
            logger.info(f"🚀 Iniciando campaña YouTube - Job: {self.job_id}")
            logger.info(f"📹 Video: {self.video_url}")
            logger.info(f"👁️  Vistas: {self.views_count}")
            logger.info(f"⏱️  Duración: {self.min_duration}-{self.max_duration}s")
            logger.info(f"🌐 Proxies: {'Sí' if self.use_proxies else 'No'} ({len(self.proxies)} disponibles)")
            
            # Ejecutar vistas con semáforo
            for i in range(self.views_count):
                try:
                    with view_semaphore:  # Control de concurrencia
                        success = self.watch_video(i + 1)
                        
                        # Actualizar progreso cada 10 vistas
                        if (i + 1) % 10 == 0 or i == self.views_count - 1:
                            progress_pct = ((i + 1) / self.views_count) * 100
                            self.update_job_status('running', {'progress': f'{progress_pct:.1f}%'})
                    
                    # Delay entre vistas (más realista)
                    if i < self.views_count - 1:
                        delay = random.uniform(3, 12)
                        logger.debug(f"Esperando {delay:.1f}s antes de la siguiente vista...")
                        time.sleep(delay)
                        
                except Exception as e:
                    logger.error(f"Error en iteración {i+1}: {e}")
                    continue
            
            # Finalizar
            final_status = 'completed' if self.successful_views > 0 else 'failed'
            self.update_job_status(final_status)
            
            logger.info(f"✅ Campaña completada - Job: {self.job_id}")
            logger.info(f"📊 Resultado: {self.successful_views}/{self.views_count} vistas exitosas "
                       f"({self.successful_views/self.views_count*100:.1f}%)")
            
        except Exception as e:
            logger.error(f"❌ Error crítico en campaña {self.job_id}: {e}")
            self.update_job_status('failed', {'error': str(e)})

def run_youtube_bot(video_url: str, views_count: int, min_duration: int, max_duration: int, job_id: str, use_proxies: bool):
    """Ejecuta el bot en background"""
    if not SELENIUM_AVAILABLE:
        logger.error("Selenium no disponible. Instala las dependencias.")
        youtube_jobs_cache.set(job_id, {
            'status': 'failed',
            'error': 'Selenium no instalado',
            'completed_views': 0,
            'total_views': views_count
        })
        return
    
    try:
        bot = YouTubeViewBot(video_url, views_count, min_duration, max_duration, job_id, use_proxies)
        bot.start_campaign()
    except Exception as e:
        logger.error(f"Error iniciando bot: {e}")
        youtube_jobs_cache.set(job_id, {
            'status': 'failed',
            'error': str(e),
            'completed_views': 0,
            'total_views': views_count
        })

# ===== Seed Data =====
SEED: Dict[str, UserInfo] = {
    "cadillacf1": UserInfo(
        username="cadillacf1", 
        full_name="Cadillac Formula 1 Team",
        follower_count=1200000, 
        following_count=200, 
        media_count=320,
        biography="Equipo F1 · Cadillac Racing", 
        is_verified=True
    ),
    "manuelturizo": UserInfo(
        username="manuelturizo", 
        full_name="Manuel Turizo",
        follower_count=18300000, 
        following_count=450, 
        media_count=1500,
        biography="Cantante", 
        is_verified=True
    ),
    "pesopluma": UserInfo(
        username="pesopluma", 
        full_name="Peso Pluma",
        follower_count=17000000, 
        following_count=210, 
        media_count=900,
        biography="Double P", 
        is_verified=True
    ),
}

def seed_or_stub(username: str) -> UserInfo:
    key = username.lower().strip()
    if key in SEED:
        return SEED[key]
    
    base = abs(hash(key)) % 1_000_000
    return UserInfo(
        username=key, 
        full_name=key,
        follower_count=20000 + (base % 50000),
        following_count=100 + (base % 900),
        media_count=50 + (base % 1500),
        biography=f"Perfil de {key}",
        is_verified=False,
    )

def with_avatar(u: UserInfo) -> dict:
    """Agrega URL de avatar al perfil"""
    d = u.dict()
    d["profile_pic_url"] = f"/avatar?username={u.username}"
    return d

# ===== Rutas Existentes =====
@app.get("/health")
def health():
    return {
        "status": "ok", 
        "name": APP_NAME, 
        "version": VERSION,
        "selenium_available": SELENIUM_AVAILABLE,
        "max_concurrent_views": MAX_CONCURRENT_VIEWS
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
    if cached:
        return json_cached({"usuario": cached}, PROFILE_MAX_AGE)
    
    info = seed_or_stub(u)
    payload = with_avatar(info)
    profile_cache.set(f"user:{u}", payload)
    return json_cached({"usuario": payload}, PROFILE_MAX_AGE)

@app.post("/refresh-clients", response_model=RefreshResp)
def refresh_clients(req: RefreshReq):
    if not req.users:
        raise HTTPException(status_code=400, detail="Falta lista de usuarios")
    
    result: Dict[str, UserInfo] = {}
    for raw_u in req.users:
        u = (raw_u or "").strip().lstrip("@").lower()
        if not u:
            continue
        
        cached = profile_cache.get(f"user:{u}")
        if cached:
            result[u] = UserInfo(**cached)
            continue
        
        info = seed_or_stub(u)
        payload = with_avatar(info)
        profile_cache.set(f"user:{u}", payload)
        result[u] = UserInfo(**payload)
    
    resp = JSONResponse({"usuarios": {k: v.dict() for k, v in result.items()}})
    resp.headers["Cache-Control"] = f"public, max-age={PROFILE_MAX_AGE}"
    return resp

@app.post("/purge-cache")
def purge_cache(x_admin_token: Optional[str] = Header(default=None)):
    if ADMIN_TOKEN and x_admin_token != ADMIN_TOKEN:
        raise HTTPException(status_code=403, detail="Forbidden")
    
    profile_cache.clear()
    youtube_jobs_cache.clear()
    return {"ok": True, "purged": True, "timestamp": datetime.now().isoformat()}

# ===== Rutas YouTube Corregidas =====
@app.post("/youtube-views", response_model=YouTubeViewsResponse)
def youtube_views(
    request: YouTubeViewsRequest, 
    background_tasks: BackgroundTasks
):
    """Inicia campaña de visualizaciones de YouTube"""
    if not SELENIUM_AVAILABLE:
        raise HTTPException(
            status_code=503, 
            detail="Servicio de YouTube Views no disponible. Instala Selenium."
        )
    
    try:
        # Validación adicional
        if request.views_count > 5000:
            raise HTTPException(status_code=400, detail="Máximo 5000 vistas por campaña")
        
        # Generar job_id único
        job_id = f"yt_{int(time.time())}_{random.randint(10000, 99999)}"
        
        # Estimación de tiempo
        avg_duration = (request.min_duration + request.max_duration) / 2
        estimated_seconds = request.views_count * (avg_duration + 10)  # +10s por delay
        estimated_time = datetime.now().timestamp() + estimated_seconds
        
        # Inicializar estado en cache
        youtube_jobs_cache.set(job_id, {
            'status': 'queued',
            'video_url': request.video_url,
            'completed_views': 0,
            'total_views': request.views_count,
            'progress': '0%',
            'start_time': None,
            'end_time': None,
            'success_rate': 0
        })
        
        # Programar tarea en background
        background_tasks.add_task(
            run_youtube_bot,
            request.video_url,
            request.views_count,
            request.min_duration,
            request.max_duration,
            job_id,
            request.use_proxies
        )
        
        logger.info(f"📺 Nueva campaña iniciada: {job_id} - {request.views_count} vistas")
        
        return YouTubeViewsResponse(
            status="queued",
            message=f"Campaña de {request.views_count} vistas programada",
            video_url=request.video_url,
            job_id=job_id,
            estimated_completion=datetime.fromtimestamp(estimated_time).isoformat()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error iniciando campaña YouTube: {e}")
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")

@app.get("/youtube-job-status/{job_id}", response_model=JobStatus)
def youtube_job_status(job_id: str):
    """Obtiene el estado de un job de YouTube"""
    job_data = youtube_jobs_cache.get(job_id)
    if not job_data:
        raise HTTPException(status_code=404, detail="Job no encontrado o expirado")
    
    return JobStatus(
        job_id=job_id,
        status=job_data.get('status', 'unknown'),
        progress=job_data.get('progress', '0%'),
        completed_views=job_data.get('completed_views', 0),
        total_views=job_data.get('total_views', 0),
        success_rate=job_data.get('success_rate', 0),
        start_time=datetime.fromisoformat(job_data.get('start_time')) if job_data.get('start_time') else None,
        end_time=datetime.fromisoformat(job_data.get('end_time')) if job_data.get('end_time') else None
    )

@app.get("/youtube-jobs")
def youtube_jobs_active():
    """Lista jobs activos de YouTube (últimas 24h)"""
    active_jobs = []
    try:
        for key, data in youtube_jobs_cache.store.items():
            if key.startswith('yt_') and data['data'].get('status') in ['queued', 'running']:
                job_data = data['data']
                active_jobs.append({
                    'job_id': key,
                    'status': job_data.get('status'),
                    'progress': job_data.get('progress', '0%'),
                    'video_url': job_data.get('video_url', ''),
                    'views': f"{job_data.get('completed_views', 0)}/{job_data.get('total_views', 0)}"
                })
    except:
        pass
    
    return {
        "active_jobs": active_jobs,
        "total_active": len(active_jobs)
    }

@app.get("/youtube-services")
def youtube_services():
    """Información de servicios de YouTube disponibles"""
    return {
        "services": [
            {
                "name": "YouTube Views Bot",
                "endpoint": "/youtube-views",
                "description": "Genera visualizaciones automáticas con comportamiento humano",
                "version": "1.1.0",
                "features": [
                    "Proxies rotativos",
                    "User-agents móviles 2025",
                    "Comportamiento humano realista",
                    "Control de concurrencia",
                    "Seguimiento de jobs",
                    "Anti-detección avanzada"
                ],
                "limits": {
                    "min_views": 10,
                    "max_views": 5000,
                    "max_concurrent": MAX_CONCURRENT_VIEWS,
                    "max_duration": 600
                },
                "requirements": [
                    "Selenium",
                    "ChromeDriver",
                    "Proxies (recomendado)"
                ]
            }
        ],
        "status": "available" if SELENIUM_AVAILABLE else "selenium_required",
        "proxies_loaded": os.path.exists(YOUTUBE_PROXY_FILE)
    }

@app.get("/youtube-proxy-test")
def youtube_proxy_test():
    """Prueba conexión a proxies configurados"""
    proxies = YouTubeViewBot("test", 1, 30, 60, "test_job", True).proxies
    if not proxies:
        return {"status": "no_proxies", "message": "No hay proxies configurados"}
    
    results = []
    for i, proxy in enumerate(proxies[:5]):  # Testea primeros 5
        try:
            # Simular request simple (no Selenium para velocidad)
            import requests
            proxy_dict = {
                'http': f"http://{proxy['ip']}:{proxy['port']}",
                'https': f"http://{proxy['ip']}:{proxy['port']}"
            }
            if proxy.get('username'):
                proxy_dict = {
                    'http': f"http://{proxy['username']}:{proxy['password']}@{proxy['ip']}:{proxy['port']}",
                    'https': f"http://{proxy['username']}:{proxy['password']}@{proxy['ip']}:{proxy['port']}"
                }
            
            response = requests.get("http://httpbin.org/ip", proxies=proxy_dict, timeout=10)
            results.append({
                "proxy": f"{proxy['ip']}:{proxy['port']}",
                "status": "working" if response.status_code == 200 else "failed",
                "response_time": response.elapsed.total_seconds(),
                "ip": response.json().get('origin', 'unknown')
            })
        except Exception as e:
            results.append({
                "proxy": f"{proxy['ip']}:{proxy['port']}",
                "status": "failed",
                "error": str(e)[:50]
            })
    
    return {
        "tested_proxies": len(results),
        "total_proxies": len(proxies),
        "results": results,
        "working_count": len([r for r in results if r['status'] == 'working'])
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
            "user_search": "/buscar-usuario",
            "youtube_views": "/youtube-views",
            "youtube_status": "/youtube-job-status/{job_id}",
            "youtube_services": "/youtube-services",
            "active_jobs": "/youtube-jobs"
        },
        "youtube_ready": SELENIUM_AVAILABLE,
        "timestamp": datetime.now().isoformat()
    }

# ===== Middleware de logging =====
@app.middleware("http")
async def log_requests(request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    
    logger.info(f"{request.client.host} - {request.method} {request.url.path} - {response.status_code} - {process_time:.2f}s")
    return response

if __name__ == "__main__":
    # Verificar dependencias críticas
    missing_deps = []
    if not SELENIUM_AVAILABLE:
        missing_deps.append("selenium webdriver-manager fake-useragent")
    
    if missing_deps:
        print("⚠️  ADVERTENCIA: Dependencias faltantes:")
        for dep in missing_deps:
            print(f"   pip install {dep}")
        print("\nEl servicio YouTube Views NO funcionará sin estas dependencias.")
        print("Las rutas existentes (usuarios, avatar) sí funcionarán.\n")
    
    # Iniciar servidor
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=5000,
        reload=os.getenv("DEVELOPMENT", "false").lower() == "true",
        log_level="info"
    )
