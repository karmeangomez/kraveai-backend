import os
import random
import logging
from instagrapi import Client
from instagrapi.exceptions import (LoginRequired, ChallengeRequired, 
                                   ClientError, ClientLoginRequired)

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("InstagramSession")

SESSION_DIR = "src/sessions"
PROXY_FILE = "src/proxies/proxies.txt"
CHALLENGE_CODE_FILE = "src/challenge_code.txt"

def get_proxy(usuario: str) -> str:
    """Obtiene un proxy aleatorio del archivo de proxies"""
    if not os.path.exists(PROXY_FILE):
        return None
        
    try:
        with open(PROXY_FILE, "r") as f:
            proxies = [line.strip() for line in f if line.strip()]
            
        if not proxies:
            return None
            
        # Selección ponderada: primeros proxies tienen mayor probabilidad
        weights = [1/(i+1) for i in range(len(proxies))]
        return random.choices(proxies, weights=weights, k=1)[0]
        
    except Exception as e:
        logger.error(f"Error al obtener proxy: {str(e)}")
        return None

def guardar_sesion(cliente: Client, usuario: str):
    """Guarda la sesión de Instagram en un archivo"""
    try:
        if not os.path.exists(SESSION_DIR):
            os.makedirs(SESSION_DIR)
            
        session_path = os.path.join(SESSION_DIR, f"ig_session_{usuario}.json")
        cliente.dump_settings(session_path)
        logger.info(f"✅ Sesión guardada para {usuario}")
        
    except Exception as e:
        logger.error(f"Error al guardar sesión: {str(e)}")

def restaurar_sesion(usuario: str) -> Client:
    """Intenta restaurar una sesión existente"""
    try:
        session_path = os.path.join(SESSION_DIR, f"ig_session_{usuario}.json")
        if not os.path.exists(session_path):
            return None
            
        cl = Client()
        proxy = get_proxy(usuario)
        
        if proxy:
            logger.info(f"🔒 Usando proxy: {proxy}")
            cl.set_proxy(proxy)
            
        cl.load_settings(session_path)
        
        # Verificar si la sesión es válida
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
    """Maneja el proceso de verificación de Instagram"""
    try:
        challenge_path = cl.last_json.get("challenge", {}).get("api_path", "")
        
        if challenge_path:
            # Intentar resolver con código de seguridad
            if os.path.exists(CHALLENGE_CODE_FILE):
                with open(CHALLENGE_CODE_FILE, "r") as f:
                    code = f.read().strip()
                    
                if code:
                    logger.info(f"🔑 Intentando código de seguridad: {code}")
                    cl.challenge_resolve(code)
                    return True
                    
            # Método alternativo: email
            logger.info("📧 Instagram requiere verificación por email")
            cl.challenge_code_handler = lambda _: input("Ingresa el código de 6 dígitos enviado por email: ")
            cl.challenge_resolve()
            return True
            
    except Exception as e:
        logger.error(f"❌ Error en verificación: {str(e)}")
        
    return False

def login_instagram(usuario: str, contraseña: str) -> Client:
    """Inicia sesión en Instagram con manejo de errores y proxies"""
    # 1. Intentar restaurar sesión existente
    cl = restaurar_sesion(usuario)
    if cl:
        return cl
        
    # 2. Configurar nuevo cliente
    cl = Client()
    proxy = get_proxy(usuario)
    
    if proxy:
        logger.info(f"🔒 Usando proxy: {proxy}")
        cl.set_proxy(proxy)
        
    # 3. Intentar inicio de sesión
    try:
        cl.login(usuario, contraseña)
        guardar_sesion(cl, usuario)
        logger.info(f"✅ Sesión iniciada para {usuario}")
        return cl
        
    except ChallengeRequired as e:
        logger.warning("⚠️ Instagram requiere verificación adicional")
        
        if resolver_challenge(cl):
            guardar_sesion(cl, usuario)
            logger.info(f"✅ Verificación exitosa para {usuario}")
            return cl
            
        logger.error("❌ No se pudo completar la verificación")
        return None
        
    except ClientError as e:
        error_msg = str(e).lower()
        
        if "password" in error_msg or "credentials" in error_msg:
            logger.error("❌ Credenciales incorrectas")
        elif "blocked" in error_msg or "blacklist" in error_msg:
            logger.error("❌ IP bloqueada por Instagram. Usa un proxy o cambia de red.")
        else:
            logger.error(f"❌ Error de cliente: {str(e)}")
            
        return None
        
    except Exception as e:
        logger.error(f"❌ Error inesperado: {str(e)}")
        return None
