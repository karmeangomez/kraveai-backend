import os
import json
import time
import random
import logging
import requests
from instagrapi import Client
from instagrapi.exceptions import (
    ChallengeRequired, LoginRequired, ClientError,
    PleaseWaitFewMinutes, BadPassword, TwoFactorRequired
)

# Configuración de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("instagram_login.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("instagram_login")

# Configuración
PROXY_FILE = "src/proxies/proxies.txt"
SESSIONS_DIR = "sessions"
MAX_RETRIES = 3
CHALLENGE_TIMEOUT = 90

USER_AGENTS = [
    "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 Chrome/112.0.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 Version/16.4 Mobile/15E148 Safari/604.1",
    "Instagram 289.0.0.21.109 Android (33/13; 480dpi; 1080x2400; Google; Pixel 7 Pro; cheetah; en_US; 460253680)"
]

def obtener_proxies():
    """Obtiene lista de proxies o usa conexión directa"""
    if not os.path.exists(PROXY_FILE):
        return ["direct"]
    
    with open(PROXY_FILE, "r") as f:
        proxies = [line.strip() for line in f if line.strip()]
    
    return proxies if proxies else ["direct"]

def configurar_dispositivo(cl):
    """Configura un dispositivo móvil realista"""
    device = {
        "app_version": "289.0.0.21.109",
        "android_version": 33,
        "android_release": "13.0.0",
        "dpi": "480dpi",
        "resolution": "1080x2400",
        "manufacturer": "Google",
        "device": "Pixel 7 Pro",
        "model": "cheetah",
        "cpu": "arm64-v8a",
        "version_code": "460253680"
    }
    cl.set_device(device)
    cl.set_user_agent(random.choice(USER_AGENTS))
    cl.set_locale("en_US")
    cl.set_country("US")
    cl.set_country_code(1)
    cl.set_timezone_offset(-21600)  # UTC-6
    return cl

def guardar_sesion(cl, username):
    """Guarda la sesión en un archivo JSON"""
    if not os.path.exists(SESSIONS_DIR):
        os.makedirs(SESSIONS_DIR)
    
    path = os.path.join(SESSIONS_DIR, f"ig_session_{username}.json")
    try:
        settings = cl.get_settings()
        # Eliminar datos sensibles
        settings.pop("password", None)
        settings.pop("device_id", None)
        
        with open(path, "w") as f:
            json.dump(settings, f, indent=2)
        
        logger.info(f"💾 Sesión guardada: {username}")
        return True
    except Exception as e:
        logger.error(f"❌ Error guardando sesión: {e}")
        return False

def cargar_sesion(username):
    """Carga la sesión desde un archivo JSON"""
    path = os.path.join(SESSIONS_DIR, f"ig_session_{username}.json")
    if not os.path.exists(path):
        return None
    
    try:
        with open(path, "r") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"❌ Error cargando sesión: {e}")
        return None

def restaurar_sesion(username, password):
    """Intenta restaurar la sesión guardada"""
    settings = cargar_sesion(username)
    if not settings:
        return None
    
    try:
        cl = Client()
        cl.set_settings(settings)
        # Verificación rápida de sesión
        cl.get_timeline_feed()
        logger.info(f"🔑 Sesión restaurada: {username}")
        return cl
    except (LoginRequired, ChallengeRequired):
        logger.info(f"⚠️ Sesión expirada, iniciando login: {username}")
        return login_instagram(username, password)
    except Exception as e:
        logger.error(f"❌ Error restaurando sesión: {e}")
        return None

def resolver_desafio(cl, username, password, proxy):
    """Maneja el proceso de verificación manual"""
    logger.info("🔐 Por favor confirma 'Fui yo' en la app móvil...")
    inicio = time.time()
    
    while time.time() - inicio < CHALLENGE_TIMEOUT:
        time.sleep(10)
        try:
            # Intento de verificación silenciosa
            cl.get_timeline_feed()
            logger.info("✅ ¡Desafío completado!")
            return cl
        except ChallengeRequired:
            tiempo_espera = int(time.time() - inicio)
            logger.info(f"⌛ Esperando confirmación ({tiempo_espera}s)...")
        except LoginRequired:
            logger.info("⚠️ Sesión expirada durante desafío, reintentando login...")
            try:
                return login_instagram(username, password, proxy)
            except Exception as e:
                logger.error(f"❌ Error en relogin: {e}")
                return None
        except Exception as e:
            logger.error(f"⚠️ Error durante desafío: {e}")
            return None
    
    logger.error("❌ Tiempo agotado para resolver el desafío")
    return None

def login_instagram(username, password, proxy=None):
    """Intenta iniciar sesión con manejo robusto de errores"""
    logger.info(f"🚀 Iniciando sesión: @{username}")
    
    proxies = obtener_proxies()
    proxy = proxy or random.choice(proxies)
    
    for intento in range(MAX_RETRIES):
        try:
            cl = Client()
            configurar_dispositivo(cl)
            
            if proxy != "direct":
                cl.set_proxy(f"http://{proxy}")
            
            # Comportamiento humano: espera aleatoria
            time.sleep(random.uniform(1, 3))
            
            cl.login(username, password)
            logger.info(f"✅ Login exitoso en intento {intento+1}")
            return cl
        except BadPassword:
            logger.error("🔑 Contraseña incorrecta")
            return None
        except TwoFactorRequired:
            logger.warning("⚠️ Requiere autenticación en dos pasos (no implementado)")
            return None
        except ChallengeRequired as e:
            logger.warning(f"⚠️ Desafío requerido: {e}")
            return resolver_desafio(cl, username, password, proxy)
        except PleaseWaitFewMinutes as e:
            espera = min(60 * (intento + 1), 300)  # Máximo 5 minutos
            logger.warning(f"⏳ Bloqueo temporal. Esperando {espera}s: {e}")
            time.sleep(espera)
        except ClientError as e:
            if "csrf" in str(e).lower():
                logger.warning("🔄 Token CSRF inválido, reintentando...")
                time.sleep(5)
            elif "429" in str(e):
                espera = 30 * (intento + 1)
                logger.warning(f"🌐 Demasiadas solicitudes. Esperando {espera}s...")
                time.sleep(espera)
            else:
                logger.error(f"❌ Error de cliente: {e}")
                return None
        except Exception as e:
            logger.error(f"❌ Error inesperado: {type(e).__name__} - {e}")
            return None
    
    logger.error("❌ Todos los intentos fallaron")
    return None
