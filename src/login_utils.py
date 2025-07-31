import os
import random
import json
import time
import logging
import requests
from instagrapi import Client
from instagrapi.exceptions import (
    ChallengeRequired, LoginRequired, ClientError, PleaseWaitFewMinutes, BadPassword
)
from dotenv import load_dotenv

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.FileHandler("instagram_login.log"), logging.StreamHandler()]
)
logger = logging.getLogger("instagram_login")

load_dotenv()
PROXY_FILE = "src/proxies/proxies.txt"
MAX_REINTENTOS = 5
ESPERA_CHALLENGE_SEGUNDOS = 90
USER_AGENTS = [
    "Instagram 269.0.0.18.75 Android (33/13; 420dpi; 1080x2400; Google; Pixel 7; panther; qcom; en_US; 440127232)",
    "Mozilla/5.0 (Linux; Android 12; SM-S906N Build/QP1A.190711.020; wv) AppleWebKit/537.36 Mobile Safari/537.36 Instagram 269.0.0.18.75 Android",
]

def obtener_proxies():
    proxies = []
    if os.path.exists(PROXY_FILE):
        with open(PROXY_FILE, "r") as f:
            for line in f:
                proxy = line.strip()
                if proxy and validar_proxy(proxy):
                    proxies.append(proxy)
    if not proxies:
        logger.warning("No se encontraron proxies válidos. Usando conexión directa.")
        return ["direct"]
    random.shuffle(proxies)
    return proxies[:MAX_REINTENTOS]

def validar_proxy(proxy):
    try:
        proxies_config = {"http": f"http://{proxy}", "https": f"http://{proxy}"}
        requests.get("https://www.instagram.com", proxies=proxies_config, timeout=10)
        return True
    except:
        return False

def configurar_dispositivo(cl):
    cl.set_device({
        "app_version": "269.0.0.18.75",
        "android_version": 33,
        "android_release": "13.0.0",
        "dpi": "420dpi",
        "resolution": "1080x2400",
        "manufacturer": "Google",
        "device": "panther",
        "model": "Pixel 7",
        "cpu": "arm64-v8a",
        "version_code": "440127232"
    })
    cl.set_user_agent(random.choice(USER_AGENTS))
    cl.set_locale("en_US")
    cl.set_country("US")
    cl.set_country_code(1)
    cl.set_timezone_offset(-21600)

def login_instagram(username, password):
    logger.info(f"🚀 Iniciando login para {username}")
    proxies = obtener_proxies()

    for i, proxy in enumerate(proxies):
        try:
            cl = Client()
            configurar_dispositivo(cl)
            if proxy != "direct":
                cl.set_proxy(f"http://{proxy}")
                logger.info(f"🔌 Proxy: {proxy}")
            else:
                logger.info("🌐 Conexión directa")

            time.sleep(random.uniform(1.5, 3.5))
            cl.login(username, password)
            logger.info(f"✅ Login exitoso: {username}")
            return cl
        except BadPassword:
            logger.error("🔑 Contraseña incorrecta")
            return None
        except ChallengeRequired:
            logger.warning("⚠️ ChallengeRequired: esperando aprobación en app")
            return resolver_desafio(cl, username, password, proxy)
        except PleaseWaitFewMinutes:
            logger.warning("⏳ Instagram pide esperar. Rotando...")
            time.sleep(30)
        except Exception as e:
            logger.error(f"❌ Error inesperado: {e}")
            continue
    return None

def resolver_desafio(cl, username, password, proxy):
    inicio = time.time()
    while time.time() - inicio < ESPERA_CHALLENGE_SEGUNDOS:
        try:
            time.sleep(10)
            cl.get_timeline_feed()
            logger.info("✅ Challenge aprobado desde app")
            return cl
        except ChallengeRequired:
            logger.info("⌛ Aún esperando aprobación manual...")
        except LoginRequired:
            try:
                configurar_dispositivo(cl)
                if proxy != "direct":
                    cl.set_proxy(f"http://{proxy}")
                cl.login(username, password)
                return cl
            except:
                return None
    logger.error("⛔ Tiempo agotado para challenge")
    return None

def guardar_sesion(cl, username):
    try:
        with open(f"ig_session_{username}.json", "w") as f:
            json.dump(cl.get_settings(), f, indent=2)
        logger.info(f"💾 Sesión guardada: {username}")
    except Exception as e:
        logger.error(f"⚠️ Error al guardar sesión: {e}")

def restaurar_sesion(username, password):
    cl = Client()
    path = f"ig_session_{username}.json"
    if os.path.exists(path):
        try:
            with open(path, "r") as f:
                cl.set_settings(json.load(f))
            configurar_dispositivo(cl)
            cl.account_info()
            logger.info(f"🔑 Sesión restaurada desde archivo: {username}")
            return cl
        except Exception as e:
            logger.warning(f"⚠️ Error restaurando sesión: {e}")
    return login_instagram(username, password)

def verificar_sesion(cl, username):
    try:
        cl.get_timeline_feed()
        return True
    except:
        return False
