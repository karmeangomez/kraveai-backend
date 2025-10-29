# youtube_bot.py - Servicio INDEPENDIENTE de YouTube Views Bot
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Dict, Optional, List
import time, random, threading, logging, os, json
from datetime import datetime
import uvicorn

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

# === Logging ===
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("YouTubeBot")

# === App ===
app = FastAPI(title="KraveAI YouTube Bot", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Cambia a tu dominio en producción
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# === Cache thread-safe ===
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

# === Modelos ===
class YouTubeViewsRequest(BaseModel):
    video_url: str
    views_count: int = Field(100, ge=10, le=1000)
    min_duration: int = Field(30, ge=10, le=300)
    max_duration: int = Field(120, ge=30, le=600)
    use_proxies: bool = True

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
                    logger.warning(f"Error cargando proxies: {e}")
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
            logger.error(f"View {view_num} falló: {e}")
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
            logger.info(f"Bot iniciado: {self.job_id} | {self.views_count} vistas")

            for i in range(self.views_count):
                success = self._watch_video(i + 1)
                if (i + 1) % 10 == 0:
                    self._update_status('running')

                if i < self.views_count - 1:
                    time.sleep(random.uniform(3, 10))

            self._update_status('completed', {'end_time': datetime.now().isoformat()})
            logger.info(f"Bot completado: {self.successful}/{self.views_count} vistas")

        except Exception as e:
            self._update_status('failed', {'error': str(e)})
            logger.error(f"Bot falló: {e}")

# === Background Runner ===
def run_bot_task(video_url, views_count, min_duration, max_duration, job_id, use_proxies):
    if not SELENIUM_AVAILABLE:
        youtube_jobs_cache.set(job_id, {'status': 'failed', 'error': 'Selenium no instalado'})
        return
    bot = YouTubeBot(video_url, views_count, min_duration, max_duration, job_id, use_proxies)
    bot.start_campaign()

# === Endpoints ===
@app.post("/youtube-views")
def youtube_views(request: YouTubeViewsRequest, background_tasks: BackgroundTasks):
    job_id = f"yt_{int(time.time())}_{random.randint(1000, 9999)}"
    youtube_jobs_cache.set(job_id, {
        'status': 'queued',
        'video_url': request.video_url,
        'total_views': request.views_count,
        'completed_views': 0,
        'progress': '0%'
    })

    background_tasks.add_task(
        run_bot_task,
        request.video_url,
        request.views_count,
        request.min_duration,
        request.max_duration,
        job_id,
        request.use_proxies
    )

    return {
        "status": "queued",
        "message": f"Campaña de {request.views_count} vistas en cola",
        "job_id": job_id,
        "video_url": request.video_url
    }

@app.get("/youtube-job-status/{job_id}")
def job_status(job_id: str):
    data = youtube_jobs_cache.get(job_id)
    if not data:
        raise HTTPException(404, "Job no encontrado")
    return data

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "YouTube Bot",
        "selenium": SELENIUM_AVAILABLE,
        "active_jobs": len([k for k in youtube_jobs_cache.store.keys() if k.startswith("yt_")])
    }

@app.get("/")
def root():
    return {"service": "KraveAI YouTube Bot", "port": 5001, "endpoints": ["/youtube-views", "/youtube-job-status/{id}"]}

if __name__ == "__main__":
    uvicorn.run("youtube_bot:app", host="0.0.0.0", port=5001, reload=False)
