import os
import random
import json
import time
import logging
import requests
from instagrapi import Client
from instagrapi.exceptions import (
    ChallengeRequired, 
    LoginRequired, 
    ClientError, 
    PleaseWaitFewMinutes,
    BadPassword,
    TwoFactorRequired
)
from dotenv import load_dotenv

# Configuración avanzada de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("instagram_login.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("instagram_login")

load_dotenv()
PROXY_FILE = "src/proxies/proxies.txt"
MAX_REINTENTOS = 5
ESPERA_CHALLENGE_SEGUNDOS = 120
USER_AGENTS = [
    "Mozilla/5.0 (Linux; Android 12; SM-S906N Build/QP1A.190711.020; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/80.0.3987.119 Mobile Safari/537.36 Instagram 269.0.0.18.75 Android (31/12; 480dpi; 1080x2400; samsung; SM-S906N; o1q; qcom; en_US; 440127232)",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1 Instagram 269.0.0.18.75 (iPhone14,3; iOS 16_0; en_US; en-US; scale=3.00; 1170x2532; 440127232)",
    "Instagram 269.0.0.18.75 Android (33/13; 420dpi; 1080x2400; Google; Pixel 7; panther; panther; en_US; 440127232)"
]

def obtener_proxies():
    """Obtiene proxies con validación avanzada"""
    proxies = []
    if os.path.exists(PROXY_FILE):
        with open(PROXY_FILE, "r") as f:
            for line in f:
                proxy = line.strip()
                if proxy and validar_proxy(proxy):
                    proxies.append(proxy)
    
    # Si no hay proxies válidos, intentar sin proxy
    if not proxies:
        logger.warning("No se encontraron proxies válidos. Usando conexión directa.")
        return ["direct"]
    
    random.shuffle(proxies)
    return proxies[:MAX_REINTENTOS]

def validar_proxy(proxy):
    """Valida proxy con múltiples tests"""
    try:
        proxies_config = {
            "http": f"http://{proxy}",
            "https": f"http://{proxy}"
        }
        
        # Test 1: Conectividad básica
        test1 = requests.get("http://google.com", proxies=proxies_config, timeout=10)
        if test1.status_code != 200:
            return False
        
        # Test 2: Acceso a Instagram
        test2 = requests.get("https://www.instagram.com", proxies=proxies_config, timeout=15)
        if test2.status_code != 200 or "instagram" not in test2.text.lower():
            return False
            
        return True
    except:
        return False

def configurar_dispositivo(cl):
    """Configuración realista de dispositivo móvil"""
    device_settings = {
        "app_version": "269.0.0.18.75",
        "android_version": random.randint(28, 33),
        "android_release": f"{random.randint(9, 13)}.0.0",
        "dpi": random.choice(["480dpi", "420dpi", "400dpi"]),
        "resolution": random.choice(["1080x2260", "1080x2400", "1440x3040"]),
        "manufacturer": random.choice(["samsung", "Google", "OnePlus", "Xiaomi"]),
        "device": random.choice(["SM-G998B", "Pixel 7", "ONEPLUS A6013", "M2101K6G"]),
        "model": random.choice(["qcom", "bengal", "lahaina", "exynos2100"]),
        "cpu": random.choice(["arm64-v8a", "armeabi-v7a", "x86_64"]),
        "version_code": "440127232"
    }
    
    cl.set_device(device_settings)
    cl.set_user_agent(random.choice(USER_AGENTS))
    cl.set_locale("en_US")
    cl.set_country("US")
    cl.set_country_code(1)
    cl.set_timezone_offset(int(time.timezone / 3600))
    
    # Comportamiento humano
    cl.set_retry_delay(random.uniform(5, 15))
    cl.set_max_retries(1)
    cl.set_request_timeout(random.uniform(15, 30))
    
    return cl

def login_instagram(username, password):
    logger.info(f"🚀 Iniciando login para {username}")
    
    proxies = obtener_proxies()
    if not proxies:
        logger.error("❌ No hay proxies disponibles")
        return None
    
    for i, proxy in enumerate(proxies):
        try:
            cl = Client()
            configurar_dispositivo(cl)
            
            # Configurar proxy o conexión directa
            if proxy != "direct":
                logger.info(f"🔌 Intento {i+1} con proxy: {proxy.split('@')[-1]}")
                cl.set_proxy(f"http://{proxy}")
            else:
                logger.info("🌐 Intentando sin proxy")
            
            # Comportamiento humano: espera antes de login
            time.sleep(random.uniform(2, 5))
            
            # Intento de login
            login_result = cl.login(username, password)
            
            if login_result:
                logger.info(f"✅ Login exitoso para {username}")
                return cl
            else:
                logger.error(f"❌ Login fallido (sin excepción) para {username}")
                continue
                
        except BadPassword:
            logger.error(f"🔑 Contraseña incorrecta para {username}")
            return None
            
        except TwoFactorRequired:
            logger.warning("⚠️ Requiere verificación en dos pasos. No implementado.")
            return None
            
        except ChallengeRequired as e:
            logger.warning(f"⚠️ Desafío de seguridad detectado: {str(e)}")
            cliente = resolver_desafio(cl, username, password, proxy)
            if cliente:
                return cliente
            continue
            
        except PleaseWaitFewMinutes as e:
            wait_time = min(120 * (i+1), 600)  # Máximo 10 minutos
            logger.warning(f"⏳ Bloqueo temporal: {e}. Esperando {wait_time}s...")
            time.sleep(wait_time)
            continue
            
        except ClientError as e:
            if "internal server error" in str(e).lower():
                logger.error("🌐 Error interno de Instagram - Probable bloqueo")
            else:
                logger.error(f"❌ Error de cliente: {e}")
            continue
            
        except Exception as e:
            logger.error(f"❌ Error inesperado: {type(e).__name__} - {str(e)}")
            continue

    logger.error(f"❌ Todos los intentos fallaron para {username}")
    return None

def resolver_desafio(cl, username, password, proxy):
    """Manejo avanzado de desafíos"""
    logger.info("🔒 Instagram requiere verificación manual")
    logger.info("📱 Por favor abre la app y confirma que fuiste tú")
    
    # Obtener detalles del desafío
    try:
        challenge_info = cl.last_json.get("challenge", {})
        logger.info(f"🔍 Tipo de desafío: {challenge_info.get('challenge_type', 'Desconocido')}")
    except:
        pass
    
    # Intentar resolver automáticamente si es posible
    try:
        if cl.challenge_resolve(cl.last_json):
            logger.info("✅ Desafío resuelto automáticamente")
            return cl
    except:
        pass
    
    # Esperar confirmación manual
    start_time = time.time()
    while time.time() - start_time < ESPERA_CHALLENGE_SEGUNDOS:
        try:
            time.sleep(10)
            
            # Verificar si el desafío fue resuelto
            cl.get_timeline_feed()
            logger.info("✅ ¡Desafío completado manualmente!")
            return cl
            
        except ChallengeRequired:
            elapsed = int(time.time() - start_time)
            logger.info(f"⌛ Esperando confirmación... ({elapsed}s)")
        except LoginRequired:
            logger.warning("⚠️ Sesión expirada durante desafío. Reintentando login...")
            try:
                # Reconfigurar dispositivo
                configurar_dispositivo(cl)
                
                if proxy != "direct":
                    cl.set_proxy(f"http://{proxy}")
                
                cl.login(username, password)
                logger.info("✅ Re-login exitoso después de desafío")
                return cl
            except Exception as e:
                logger.error(f"❌ Error en re-login: {e}")
                return None
        except Exception as e:
            logger.error(f"⚠️ Error durante desafío: {e}")
    
    logger.error("❌ Tiempo agotado para resolver el desafío")
    return None

def guardar_sesion(cl, username):
    path = f"ig_session_{username}.json"
    try:
        settings = cl.get_settings()
        
        # No guardar información sensible
        if "password" in settings:
            del settings["password"]
        if "device_settings" in settings:
            settings["device_settings"]["device_id"] = ""
        
        with open(path, "w") as f:
            json.dump(settings, f, indent=2)
        logger.info(f"💾 Sesión guardada para {username}")
    except Exception as e:
        logger.error(f"⚠️ Error guardando sesión: {e}")

def restaurar_sesion(username, password):
    path = f"ig_session_{username}.json"
    cl = Client()
    
    if os.path.exists(path):
        try:
            with open(path, "r") as f:
                settings = json.load(f)
                cl.set_settings(settings)
            
            # Verificar si la sesión sigue activa
            try:
                cl.account_info()
                logger.info(f"🔑 Sesión restaurada para {username}")
                return cl
            except (LoginRequired, ChallengeRequired):
                logger.warning("⚠️ Sesión expirada. Intentando relogin...")
        except Exception as e:
            logger.error(f"⚠️ Error restaurando sesión: {e}")
    
    # Si no se puede restaurar, hacer login normal
    return login_instagram(username, password)

def verificar_sesion(cl, username):
    try:
        # Método rápido y de bajo perfil
        cl.get_timeline_feed()
        return True
    except (LoginRequired, ChallengeRequired):
        return False
    except Exception as e:
        logger.error(f"⚠️ Error verificando sesión: {e}")
        return False

# Función para debug avanzado
def test_login(username, password):
    """Función para probar login con diferentes configuraciones"""
    logger.info("🧪 Iniciando prueba de login avanzada")
    
    # 1. Intentar sin proxy
    logger.info("🔍 Prueba 1: Sin proxy")
    cl = Client()
    configurar_dispositivo(cl)
    try:
        cl.login(username, password)
        logger.info("✅ Éxito sin proxy")
        return cl
    except Exception as e:
        logger.error(f"❌ Fallo sin proxy: {e}")
    
    # 2. Intentar con proxy
    proxies = obtener_proxies()
    if proxies:
        logger.info("🔍 Prueba 2: Con proxy")
        for proxy in proxies:
            if proxy == "direct":
                continue
            try:
                cl = Client()
                configurar_dispositivo(cl)
                cl.set_proxy(f"http://{proxy}")
                cl.login(username, password)
                logger.info(f"✅ Éxito con proxy {proxy.split('@')[-1]}")
                return cl
            except Exception as e:
                logger.error(f"❌ Fallo con proxy {proxy}: {e}")
    
    # 3. Intentar con sesión guardada
    logger.info("🔍 Prueba 3: Restaurar sesión")
    try:
        cl = restaurar_sesion(username, password)
        if cl:
            logger.info("✅ Éxito restaurando sesión")
            return cl
    except Exception as e:
        logger.error(f"❌ Fallo restaurando sesión: {e}")
    
    logger.error("🔧 Todas las pruebas fallaron")
    return None
