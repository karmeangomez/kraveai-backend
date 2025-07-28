import os
import random
import logging
from instagrapi import Client
from instagrapi.exceptions import (LoginRequired, ChallengeRequired, 
                                   ClientError, ClientLoginRequired)

logger = logging.getLogger("InstagramSession")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SESSION_DIR = os.path.join(BASE_DIR, "sessions")
PROXY_FILE = os.path.join(BASE_DIR, "proxies", "proxies.txt")
CHALLENGE_CODE_FILE = os.path.join(BASE_DIR, "challenge_code.txt")

def get_proxy() -> str:
    if not os.path.exists(PROXY_FILE):
        logger.warning("⚠️ Archivo de proxies no encontrado")
        return None
    try:
        with open(PROXY_FILE, "r") as f:
            proxies = [line.strip() for line in f if line.strip()]
        if not proxies:
            logger.warning("⚠️ Archivo de proxies vacío")
            return None
        weights = [1/(i+1) for i in range(len(proxies))]
        proxy = random.choices(proxies, weights=weights, k=1)[0]
        logger.info(f"🔒 Proxy seleccionado: {proxy}")
        return proxy
    except Exception as e:
        logger.error(f"❌ Error al obtener proxy: {str(e)}")
        return None

def guardar_sesion(cliente: Client, usuario: str):
    try:
        if not os.path.exists(SESSION_DIR):
            os.makedirs(SESSION_DIR)
        session_path = os.path.join(SESSION_DIR, f"ig_session_{usuario}.json")
        cliente.dump_settings(session_path)
        logger.info(f"✅ Sesión guardada para {usuario}")
    except Exception as e:
        logger.error(f"❌ Error al guardar sesión: {str(e)}")

def restaurar_sesion(usuario: str) -> Client:
    try:
        session_path = os.path.join(SESSION_DIR, f"ig_session_{usuario}.json")
        if not os.path.exists(session_path):
            logger.info(f"ℹ️ No se encontró sesión guardada para {usuario}")
            return None
        cl = Client()
        proxy = get_proxy()
        if proxy:
            cl.set_proxy(proxy)
        cl.load_settings(session_path)
        cl.get_timeline_feed()
        logger.info(f"♻️ Sesión restaurada para {usuario}")
        return cl
    except (LoginRequired, ChallengeRequired, ClientLoginRequired):
        logger.warning("⚠️ Sesión expirada o requiere verificación")
        return None
    except Exception as e:
        logger.error(f"❌ Error restaurando sesión: {str(e)}")
        return None

def resolver_challenge(cl: Client):
    try:
        if os.path.exists(CHALLENGE_CODE_FILE):
            with open(CHALLENGE_CODE_FILE, "r") as f:
                code = f.read().strip()
            if code:
                logger.info(f"🔑 Intentando código de seguridad: {code}")
                result = cl.challenge_resolve(code)
                if result:
                    return True
        logger.warning("📧 Instagram requiere verificación por email")
        logger.error("""
        !!! ATENCIÓN !!!
        Revisa el email y coloca el código en challenge_code.txt
        """)
    except Exception as e:
        logger.error(f"❌ Error en verificación: {str(e)}")
    return False

def login_instagram(usuario: str, contraseña: str) -> Client:
    cl = Client()
    proxy = get_proxy()
    if proxy:
        cl.set_proxy(proxy)
    cl.delay_range = [3, 7]
    cl.request_timeout = 30
    try:
        logger.info(f"🔐 Intentando login para {usuario}")
        cl.login(usuario, contraseña)
        guardar_sesion(cl, usuario)
        logger.info(f"✅ Sesión iniciada para {usuario}")
        return cl
    except ChallengeRequired:
        logger.warning("⚠️ Instagram requiere verificación")
        if resolver_challenge(cl):
            guardar_sesion(cl, usuario)
            logger.info(f"✅ Verificación exitosa para {usuario}")
            return cl
        logger.error("❌ No se pudo completar la verificación")
        return None
    except ClientError as e:
        msg = str(e).lower()
        if "password" in msg:
            logger.error("❌ Credenciales incorrectas")
        elif "blocked" in msg:
            logger.error("❌ IP bloqueada por Instagram")
        else:
            logger.error(f"❌ Error de cliente: {str(e)}")
        return None
    except Exception as e:
        logger.error(f"❌ Error inesperado: {str(e)}")
        return None
