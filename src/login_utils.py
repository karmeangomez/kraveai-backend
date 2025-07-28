import os
import random
import logging
from instagrapi import Client
from instagrapi.exceptions import (
    LoginRequired, ChallengeRequired,
    ClientError, ClientLoginRequired
)

logger = logging.getLogger("InstagramSession")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SESSION_DIR = os.path.join(BASE_DIR, "sessions")
PROXY_FILE = os.path.join(BASE_DIR, "proxies", "proxies.txt")
CHALLENGE_CODE_FILE = os.path.join(BASE_DIR, "challenge_code.txt")

def get_proxy() -> str:
    try:
        if not os.path.exists(PROXY_FILE):
            return None
        with open(PROXY_FILE, "r") as f:
            proxies = [line.strip() for line in f if line.strip()]
        if not proxies:
            return None
        proxy = random.choice(proxies)
        logger.info(f"🔌 Usando proxy: {proxy}")
        return proxy
    except Exception as e:
        logger.error(f"Error obteniendo proxy: {e}")
        return None

def guardar_sesion(cliente: Client, usuario: str):
    try:
        os.makedirs(SESSION_DIR, exist_ok=True)
        path = os.path.join(SESSION_DIR, f"ig_session_{usuario}.json")
        cliente.dump_settings(path)
        logger.info(f"✅ Sesión guardada para {usuario}")
    except Exception as e:
        logger.error(f"Error guardando sesión: {e}")

def restaurar_sesion(usuario: str) -> Client:
    try:
        path = os.path.join(SESSION_DIR, f"ig_session_{usuario}.json")
        if not os.path.exists(path):
            logger.warning(f"⚠️ No hay sesión guardada para {usuario}")
            return None

        cl = Client()
        proxy = get_proxy()
        if proxy:
            cl.set_proxy(proxy)

        cl.load_settings(path)
        cl.get_timeline_feed()
        logger.info(f"♻️ Sesión restaurada para {usuario}")
        return cl

    except (LoginRequired, ChallengeRequired, ClientLoginRequired):
        logger.warning(f"⚠️ Sesión expirada para {usuario}")
        return None
    except Exception as e:
        logger.error(f"Error al restaurar sesión: {e}")
        return None

def resolver_challenge(cl: Client):
    try:
        if os.path.exists(CHALLENGE_CODE_FILE):
            with open(CHALLENGE_CODE_FILE, "r") as f:
                code = f.read().strip()
            if code:
                logger.info(f"📩 Intentando resolver challenge con código: {code}")
                result = cl.challenge_resolve(code)
                return result
        logger.warning("⚠️ Código de verificación no disponible")
    except Exception as e:
        logger.error(f"Error en challenge: {e}")
    return False

def login_instagram(usuario: str, contraseña: str) -> Client:
    cl = Client()
    proxy = get_proxy()
    if proxy:
        cl.set_proxy(proxy)

    cl.delay_range = [3, 7]
    cl.request_timeout = 30

    try:
        logger.info(f"🔐 Iniciando sesión para {usuario}")
        cl.login(usuario, contraseña)
        guardar_sesion(cl, usuario)
        return cl

    except ChallengeRequired:
        logger.warning("📧 Instagram requiere challenge...")
        if resolver_challenge(cl):
            guardar_sesion(cl, usuario)
            return cl
        return None

    except ClientError as e:
        logger.error(f"❌ Error de cliente: {str(e)}")
        return None
    except Exception as e:
        logger.error(f"❌ Error inesperado: {str(e)}")
        return None
