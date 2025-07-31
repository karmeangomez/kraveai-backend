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
    handlers=[
        logging.FileHandler("instagram_login.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("instagram_login")

load_dotenv()

PROXY_FILE = "src/proxies/proxies.txt"
MAX_REINTENTOS = 5
ESPERA_CHALLENGE_SEGUNDOS = 90
REINTENTOS_CSRF = 3

USER_AGENTS = [
    "Mozilla/5.0 (Linux; Android 12; SM-S906N Build/QP1A.190711.020; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/80.0.3987.119 Mobile Safari/537.36 Instagram 269.0.0.18.75 Android",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1 Instagram 269.0.0.18.75",
    "Instagram 269.0.0.18.75 Android (33/13; 420dpi; 1080x2400; Google; Pixel 7; panther; panther; en_US; 440127232)"
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
        logger.warning("⚠️ No se encontraron proxies válidos. Usando conexión directa.")
        return ["direct"]
    random.shuffle(proxies)
    return proxies[:MAX_REINTENTOS]

def validar_proxy(proxy):
    try:
        proxies_config = {
            "http": f"http://{proxy}",
            "https": f"http://{proxy}"
        }
        test1 = requests.get("http://google.com", proxies=proxies_config, timeout=10)
        if test1.status_code != 200:
            return False
        test2 = requests.get("https://www.instagram.com", proxies=proxies_config, timeout=15)
        return test2.status_code == 200 and "instagram" in test2.text.lower()
    except:
        return False

def configurar_dispositivo(cl):
    cl.set_device({
        "app_version": "269.0.0.18.75",
        "android_version": random.randint(28, 33),
        "android_release": f"{random.randint(9, 13)}.0.0",
        "dpi": random.choice(["480dpi", "420dpi"]),
        "resolution": random.choice(["1080x2260", "1080x2400"]),
        "manufacturer": random.choice(["samsung", "Google"]),
        "device": random.choice(["SM-G998B", "Pixel 7"]),
        "model": random.choice(["qcom", "exynos2100"]),
        "cpu": "arm64-v8a",
        "version_code": "440127232"
    })
    cl.set_user_agent(random.choice(USER_AGENTS))
    cl.set_locale("en_US")
    cl.set_country("US")
    cl.set_country_code(1)
    cl.set_timezone_offset(-21600)  # UTC-6

def login_instagram(username, password):
    logger.info(f"🚀 Iniciando login para {username}")
    proxies = obtener_proxies()

    for i, proxy in enumerate(proxies):
        for intento_csrftoken in range(REINTENTOS_CSRF):
            try:
                cl = Client()
                configurar_dispositivo(cl)
                if proxy != "direct":
                    cl.set_proxy(f"http://{proxy}")
                    logger.info(f"🔌 Proxy usado: {proxy}")
                else:
                    logger.info("🌐 Conexión directa")

                time.sleep(random.uniform(1.5, 3.5))
                if cl.login(username, password):
                    logger.info(f"✅ Login exitoso: {username}")
                    return cl

            except BadPassword:
                logger.error("🔑 Contraseña incorrecta")
                return None
            except ChallengeRequired:
                logger.warning("⚠️ ChallengeRequired: esperando confirmación en app")
                return resolver_desafio(cl, username, password, proxy)
            except PleaseWaitFewMinutes as e:
                logger.warning(f"⏳ Espera impuesta por Instagram: {e}")
                time.sleep(30)
            except ClientError as e:
                if "CSRF token missing" in str(e):
                    logger.warning("🔁 CSRF token incorrecto. Reintentando...")
                    time.sleep(5)
                    continue
                else:
                    logger.error(f"❌ ClientError: {e}")
            except Exception as e:
                logger.error(f"❌ Error inesperado: {e}")
        logger.info("⛔ Agotados reintentos por CSRF con este proxy")
    logger.error("❌ Todos los intentos fallaron")
    return None

def resolver_desafio(cl, username, password, proxy):
    logger.info("📱 Esperando verificación manual desde la app...")
    inicio = time.time()
    while time.time() - inicio < ESPERA_CHALLENGE_SEGUNDOS:
        try:
            time.sleep(10)
            cl.get_timeline_feed()
            logger.info("✅ Challenge aprobado desde app")
            return cl
        except ChallengeRequired:
            logger.info("⌛ Aún esperando confirmación...")
        except LoginRequired:
            try:
                configurar_dispositivo(cl)
                if proxy != "direct":
                    cl.set_proxy(f"http://{proxy}")
                cl.login(username, password)
                return cl
            except Exception:
                return None
    logger.error("⛔ Tiempo agotado para resolver challenge")
    return None

def guardar_sesion(cl, username):
    try:
        with open(f"ig_session_{username}.json", "w") as f:
            json.dump(cl.get_settings(), f, indent=2)
        logger.info(f"💾 Sesión guardada: {username}")
    except Exception as e:
        logger.error(f"⚠️ Error al guardar sesión: {e}")

def restaurar_sesion(username, password):
    path = f"ig_session_{username}.json"
    cl = Client()
    if os.path.exists(path):
        try:
            with open(path, "r") as f:
                cl.set_settings(json.load(f))
            cl.account_info()
            logger.info(f"🔑 Sesión restaurada: {username}")
            return cl
        except Exception as e:
            logger.warning(f"⚠️ Sesión inválida, reintentando login: {e}")
    return login_instagram(username, password)

def verificar_sesion(cl, username):
    try:
        cl.get_timeline_feed()
        return True
    except:
        return False
