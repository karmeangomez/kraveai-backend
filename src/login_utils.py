import os
import json
import random
import time
import logging
import requests
from instagrapi import Client
from instagrapi.exceptions import (
    ChallengeRequired, LoginRequired, PleaseWaitFewMinutes, ClientError
)

# Configuración de logs
logger = logging.getLogger("instagram_login")
logger.setLevel(logging.INFO)
handler = logging.StreamHandler()
handler.setFormatter(logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s"))
logger.addHandler(handler)

SESSION_DIR = "sessions"
PROXY_FILE = "src/proxies/proxies.txt"

def formatear_proxy(proxy_raw):
    proxy_raw = proxy_raw.strip().replace(" ", "")
    if not proxy_raw:
        return None
    if proxy_raw.startswith("http://") or proxy_raw.startswith("socks5://"):
        return proxy_raw
    parts = proxy_raw.split(":")
    if len(parts) == 2:
        return f"http://{parts[0]}:{parts[1]}"
    elif len(parts) == 4:
        return f"http://{parts[2]}:{parts[3]}@{parts[0]}:{parts[1]}"
    else:
        return None

def cargar_proxies():
    if not os.path.exists(PROXY_FILE):
        return []
    with open(PROXY_FILE, "r") as f:
        lines = f.readlines()
    proxies = [formatear_proxy(line) for line in lines]
    return [p for p in proxies if p]

def seleccionar_proxy_aleatorio():
    proxies = cargar_proxies()
    if proxies:
        return random.choice(proxies)
    return None

def generar_client(proxy=None):
    cl = Client()
    cl.delay_range = [2, 5]
    cl.set_user_agent(Client().user_agent)
    if proxy:
        cl.set_proxy(proxy)
    return cl

def restaurar_sesion(username):
    path = os.path.join(SESSION_DIR, f"ig_session_{username}.json")
    if os.path.exists(path):
        cl = generar_client()
        try:
            cl.load_settings(path)
            cl.login(username, "")
            cl.get_timeline_feed()
            logger.info(f"✅ Sesión restaurada para @{username}")
            return cl
        except Exception as e:
            logger.warning(f"⚠️ No se pudo restaurar sesión para @{username}: {e}")
    return None

def guardar_sesion(cl, username):
    os.makedirs(SESSION_DIR, exist_ok=True)
    path = os.path.join(SESSION_DIR, f"ig_session_{username}.json")
    cl.dump_settings(path)
    logger.info(f"💾 Sesión guardada para @{username} en {path}")

def login_instagram(username, password, max_reintentos=3):
    cl = restaurar_sesion(username)
    if cl:
        return cl

    for intento in range(max_reintentos):
        proxy = seleccionar_proxy_aleatorio()
        logger.info(f"🌐 Usando proxy: {proxy if proxy else 'sin proxy'}")
        cl = generar_client(proxy)

        try:
            cl.login(username, password)
            guardar_sesion(cl, username)
            logger.info(f"✅ Login exitoso para @{username}")
            return cl

        except ChallengeRequired:
            logger.warning("⚠️ Desafío requerido. Esperando aprobación manual...")
            for i in range(9):
                time.sleep(10)
                try:
                    cl.get_timeline_feed()
                    guardar_sesion(cl, username)
                    logger.info("✅ Desafío completado tras aprobación")
                    return cl
                except ChallengeRequired:
                    logger.info(f"⌛ Esperando... {10*(i+1)}s")

        except PleaseWaitFewMinutes:
            logger.warning("⏳ Instagram pidió esperar. Reintentando con otro proxy...")

        except ClientError as e:
            logger.error(f"❌ ClientError: {e}")

        except Exception as e:
            logger.error(f"❌ Error general: {e}")

        logger.info(f"🔁 Reintentando login... ({intento + 1}/{max_reintentos})")

    logger.error(f"❌ Todos los intentos fallaron para @{username}")
    return None
