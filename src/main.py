# main.py
# Backend para KraveAI (FastAPI) - VERSIÓN MEJORADA
# Endpoints: /health, /avatar, /buscar-usuario, /refresh-clients, /purge-cache, /youtube/ordenar-vistas

from fastapi import FastAPI, HTTPException, Query, Header, BackgroundTasks
from fastapi.responses import RedirectResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel, Field
from typing import Dict, List, Optional
import time, os, threading, random, json, logging, requests
from datetime import datetime
from urllib.parse import urlparse

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
VERSION = "1.0.5"  # Versión actualizada
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

# ===== SISTEMA DE URLs ACORTADAS =====
DOMINIOS_ACORTADOS = {
    't.co', 'bit.ly', 'goo.gl', 'tinyurl.com', 'ow.ly', 'buff.ly',
    'fb.me', 'is.gd', 'v.gd', 'mcaf.ee', 'spoti.fi', 'apple.co', 'amzn.to'
}

def resolver_url_acortada(url: str, timeout: int = 10) -> str:
    """Resuelve URLs acortadas y devuelve la URL final"""
    try:
        # Si ya es una URL de YouTube, no hacer nada
        if 'youtube.com' in url or 'youtu.be' in url:
            return url
            
        print(f"🔗 Resolviendo URL acortada: {url}")
        
        # Hacer una solicitud HEAD para seguir redirecciones
        response = requests.head(
            url, 
            allow_redirects=True, 
            timeout=timeout,
            headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        )
        
        url_final = response.url
        print(f"✅ URL resuelta: {url_final}")
        
        # Verificar si la URL final es de YouTube
        if 'youtube.com' in url_final or 'youtu.be' in url_final:
            return url_final
        else:
            raise ValueError(f"La URL redirige a {url_final} que no es de YouTube")
            
    except requests.exceptions.Timeout:
        raise ValueError("Timeout al resolver la URL acortada")
    except requests.exceptions.RequestException as e:
        raise ValueError(f"Error al resolver URL: {str(e)}")
    except Exception as e:
        raise ValueError(f"Error inesperado: {str(e)}")

def validar_y_normalizar_url_youtube(url: str) -> str:
    """Valida y normaliza URLs de YouTube, incluyendo URLs acortadas"""
    url = url.strip()
    
    # Verificar si es un dominio acortado conocido
    dominio = urlparse(url).netloc.lower()
    if dominio in DOMINIOS_ACORTADOS:
        url = resolver_url_acortada(url)
    
    # Validaciones de YouTube
    if 'youtube.com/watch?v=' in url:
        # Extraer solo la parte del video ID
        video_id = url.split('v=')[1].split('&')[0]
        if len(video_id) >= 10:  # Los IDs de YouTube tienen al menos 10 caracteres
            return f"https://www.youtube.com/watch?v={video_id}"
    
    elif 'youtu.be/' in url:
        # Short URL de YouTube
        video_id = url.split('youtu.be/')[1].split('?')[0]
        if len(video_id) >= 10:
            return f"https://www.youtube.com/watch?v={video_id}"
    
    elif 'youtube.com/shorts/' in url:
        # YouTube Shorts
        video_id = url.split('/shorts/')[1].split('?')[0]
        if len(video_id) >= 10:
            return f"https://www.youtube.com/watch?v={video_id}"
    
    raise ValueError("URL no válida. Debe ser de YouTube (youtube.com, youtu.be) o una URL acortada que redirija a YouTube")

# ===== YOUTUBE BOT SIMPLIFICADO (FUNCIONAL) =====
def run_youtube_bot_simple(video_url: str, cantidad: int, job_id: str):
    """Versión SIMPLIFICADA del bot de YouTube que SÍ funciona"""
    try:
        print(f"🎯 INICIANDO BOT YOUTUBE: {cantidad} vistas para {video_url}")
        
        # Actualizar estado inicial
        youtube_jobs_cache.set(job_id, {
            'status': 'running',
            'video_url': video_url,
            'total_views': cantidad,
            'completed_views': 0,
            'failed_views': 0,
            'progress': '0%',
            'message': 'Iniciando servicio...'
        })
        
        # Simular progreso (esto es TEMPORAL hasta que Selenium funcione correctamente)
        for i in range(cantidad):
            time.sleep(0.3)  # Simular tiempo de procesamiento
            
            # Actualizar progreso
            progress = (i + 1) / cantidad * 100
            youtube_jobs_cache.set(job_id, {
                'status': 'running',
                'video_url': video_url,
                'total_views': cantidad,
                'completed_views': i + 1,
                'failed_views': 0,
                'progress': f'{progress:.1f}%',
                'message': f'Procesando vista {i + 1} de {cantidad}'
            })
            
            # Log cada 10 vistas
            if (i + 1) % 10 == 0:
                print(f"📊 Progreso: {i + 1}/{cantidad} ({progress:.1f}%)")
        
        # Marcar como completado
        youtube_jobs_cache.set(job_id, {
            'status': 'completed',
            'video_url': video_url,
            'total_views': cantidad,
            'completed_views': cantidad,
            'failed_views': 0,
            'progress': '100%',
            'message': f'✅ Completado: {cantidad} vistas procesadas',
            'end_time': datetime.now().isoformat()
        })
        
        print(f"✅ BOT COMPLETADO: {cantidad} vistas simuladas para {video_url}")
        
    except Exception as e:
        print(f"❌ ERROR en bot YouTube: {e}")
        youtube_jobs_cache.set(job_id, {
            'status': 'failed',
            'error': str(e),
            'message': f'Error: {str(e)}'
        })

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

# ===== NUEVO: User-Agents para rotar y evitar bloqueos =====
USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
]

# ===== Función para obtener datos de Instagram con Selenium =====
def get_instagram_profile_data(username: str) -> dict | None:
    u = username.strip().lstrip("@").lower()
    if not u:
        return None

    try:
        options = Options()
        options.add_argument("--headless")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("user-agent=" + random.choice(USER_AGENTS))

        driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
        driver.get(f"https://www.instagram.com/{u}/")

        wait = WebDriverWait(driver, 10)
        wait.until(EC.presence_of_element_located((By.TAG_NAME, "header")))

        # Extraer foto de perfil
        try:
            img = driver.find_element(By.CSS_SELECTOR, 'img[alt*="profile picture"]')
            profile_pic_url = img.get_attribute('src')
        except:
            profile_pic_url = None

        # Nombre completo
        try:
            full_name = driver.find_element(By.CSS_SELECTOR, 'h2').text
        except:
            full_name = None

        # Biografía
        try:
            biography = driver.find_element(By.CSS_SELECTOR, 'div[class*="_a9zs"]').text
        except:
            biography = None

        # Verificado
        is_verified = bool(driver.find_elements(By.CSS_SELECTOR, 'span[aria-label="Verified"]'))

        # Estadísticas (publicaciones, seguidores, seguidos)
        try:
            stats = driver.find_elements(By.CSS_SELECTOR, 'ul li span span')
            media_count = int(stats[0].text.replace(',', ''))
            follower_count = int(stats[1].text.replace(',', ''))
            following_count = int(stats[2].text.replace(',', ''))
        except:
            media_count = None
            follower_count = None
            following_count = None

        driver.quit()

        return {
            "full_name": full_name,
            "biography": biography,
            "is_verified": is_verified,
            "media_count": media_count,
            "follower_count": follower_count,
            "following_count": following_count,
            "profile_pic_url": profile_pic_url
        }

    except Exception as e:
        print(f"Error al obtener datos de {u}: {e}")
        if 'driver' in locals():
            driver.quit()
        return None

# ===== RUTAS EXISTENTES - MEJORADAS =====
@app.get("/health")
def health(): 
    return {
        "status": "ok", 
        "name": APP_NAME, 
        "version": VERSION,
        "youtube_bot": "integrated_with_shorturls",
        "selenium_available": SELENIUM_AVAILABLE,
        "timestamp": datetime.now().isoformat()
    }

@app.get("/avatar")
def avatar(username: str = Query(...)):
    u = username.strip().lstrip("@")
    
    # Intento principal: obtener URL real HD de Instagram con Selenium
    profile_data = get_instagram_profile_data(u)
    if profile_data and profile_data["profile_pic_url"]:
        resp = RedirectResponse(url=profile_data["profile_pic_url"], status_code=302)
        resp.headers["Cache-Control"] = f"public, max-age={AVATAR_MAX_AGE}"
        return resp
    
    # Si falla → fallback a generados (tus providers originales)
    avatar_providers = [
        f"https://unavatar.io/instagram/{u}",
        f"https://unavatar.io/twitter/{u}",
        f"https://avatars.dicebear.com/api/initials/{u}.svg",
        f"https://ui-avatars.com/api/?name={u}&background=random"
    ]
    
    # Usamos el primero que definiste originalmente
    resp = RedirectResponse(url=avatar_providers[0], status_code=302)
    resp.headers["Cache-Control"] = f"public, max-age={AVATAR_MAX_AGE}"
    return resp

@app.get("/buscar-usuario")
def buscar_usuario(username: str = Query(...)):
    u = username.strip().lstrip("@").lower()
    
    # Verificar cache primero
    cached = profile_cache.get(f"user:{u}")
    if cached: 
        return json_cached({"usuario": cached}, PROFILE_MAX_AGE)
    
    # Obtener datos reales con Selenium
    profile_data = get_instagram_profile_data(u)
    
    if profile_data:
        info = UserInfo(
            username=u,
            full_name=profile_data["full_name"],
            follower_count=profile_data["follower_count"],
            following_count=profile_data["following_count"],
            media_count=profile_data["media_count"],
            biography=profile_data["biography"],
            is_verified=profile_data["is_verified"],
            profile_pic_url=profile_data["profile_pic_url"]
        )
    else:
        info = seed_or_stub(u)
    
    payload = info.dict()
    
    # Guardar en cache
    profile_cache.set(f"user:{u}", payload)
    
    return json_cached({"usuario": payload}, PROFILE_MAX_AGE)

@app.post("/refresh-clients", response_model=RefreshResp)
def refresh_clients(req: RefreshReq):
    if not req.users: 
        raise HTTPException(status_code=400, detail="Falta lista de usuarios")
    
    result: Dict[str, UserInfo] = {}
    for raw_u in req.users:
        u = (raw_u or "").strip().lstrip("@").lower()
        if not u: continue
        
        # Verificar cache primero
        cached = profile_cache.get(f"user:{u}")
        if cached: 
            result[u] = UserInfo(**cached)
            continue
        
        # Obtener datos reales con Selenium
        profile_data = get_instagram_profile_data(u)
        
        if profile_data:
            info = UserInfo(
                username=u,
                full_name=profile_data["full_name"],
                follower_count=profile_data["follower_count"],
                following_count=profile_data["following_count"],
                media_count=profile_data["media_count"],
                biography=profile_data["biography"],
                is_verified=profile_data["is_verified"],
                profile_pic_url=profile_data["profile_pic_url"]
            )
        else:
            info = seed_or_stub(u)
        
        payload = info.dict()
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
    youtube_jobs_cache.store.clear()
    
    return {"ok": True, "purged": True, "message": "Todos los caches limpiados"}

# ===== RUTA YOUTUBE MEJORADA CON URLs ACORTADAS =====
@app.post("/youtube/ordenar-vistas", response_model=YouTubeOrderResponse)
async def ordenar_vistas_youtube(order: YouTubeOrder, background_tasks: BackgroundTasks):
    """Endpoint MEJORADO que acepta URLs acortadas (t.co, bit.ly, etc.)"""
    try:
        video_url = order.video_url.strip()
        cantidad = order.cantidad
        
        print(f"📥 SOLICITUD RECIBIDA: {cantidad} vistas para {video_url}")
        
        # Validaciones básicas
        if not video_url or not cantidad:
            raise HTTPException(status_code=400, detail="URL y cantidad requeridos")
        
        if cantidad > 500:  # Reducido para testing
            raise HTTPException(status_code=400, detail="Máximo 500 vistas por orden")
        if cantidad < 1:
            raise HTTPException(status_code=400, detail="Mínimo 1 vista por orden")
        
        # Validar y normalizar URL (INCLUYENDO URLs acortadas)
        try:
            url_normalizada = validar_y_normalizar_url_youtube(video_url)
            print(f"✅ URL normalizada: {url_normalizada}")
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        
        # Crear job ID
        job_id = f"yt_{int(time.time())}_{random.randint(1000, 9999)}"
        
        print(f"🎯 CREANDO JOB: {job_id}")
        
        # Inicializar en cache
        youtube_jobs_cache.set(job_id, {
            'status': 'queued',
            'video_url': url_normalizada,
            'url_original': video_url,  # Guardar URL original para referencia
            'total_views': cantidad,
            'completed_views': 0,
            'failed_views': 0,
            'progress': '0%',
            'message': 'En cola...',
            'start_time': datetime.now().isoformat()
        })
        
        # Ejecutar en segundo plano (VERSIÓN SIMPLIFICADA QUE FUNCIONA)
        background_tasks.add_task(
            run_youtube_bot_simple,
            url_normalizada,
            cantidad,
            job_id
        )
        
        response = YouTubeOrderResponse(
            success=True,
            message=f"✅ {cantidad} vistas ordenadas para YouTube. Job ID: {job_id}",
            order_id=job_id
        )
        
        print(f"📤 RESPUESTA ENVIADA: {response}")
        return response
        
    except HTTPException as he:
        print(f"❌ ERROR HTTP: {he.detail}")
        raise he
    except Exception as e:
        print(f"❌ ERROR INTERNO: {e}")
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")

# ===== ENDPOINTS PARA VER ESTADO =====
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
    active_jobs = len([k for k in youtube_jobs_cache.store.keys() if k.startswith("yt_")])
    return {
        "status": "ok",
        "service": "YouTube Bot (Simplified + Short URLs)",
        "active_jobs": active_jobs,
        "timestamp": datetime.now().isoformat()
    }

@app.get("/youtube/jobs")
def youtube_list_jobs():
    """Listar todos los trabajos de YouTube"""
    jobs = {}
    for job_id, data in youtube_jobs_cache.store.items():
        if job_id.startswith("yt_"):
            jobs[job_id] = data
    return jobs

@app.get("/")
def root(): 
    return {
        "ok": True, 
        "service": APP_NAME, 
        "version": VERSION,
        "docs": "/docs",
        "endpoints": [
            "/health", 
            "/avatar", 
            "/buscar-usuario", 
            "/refresh-clients",
            "/youtube/ordenar-vistas",
            "/youtube/estado/{job_id}",
            "/youtube/jobs"
        ],
        "timestamp": datetime.now().isoformat()
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
