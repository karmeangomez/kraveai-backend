# src/login_utils.py

import os
import time
import json
import random
import logging
import requests
from instagrapi import Client
from instagrapi.exceptions import (
    ChallengeRequired, PleaseWaitFewMinutes, LoginRequired, ClientError
)
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

SESSIONS_DIR = "src/sessions"
PROXIES_FILE = "src/proxies/proxies.txt"
CUENTAS_FILE = "cuentas_creadas.json"

if not os.path.exists(SESSIONS_DIR):
    os.makedirs(SESSIONS_DIR)

usuarios_activos = {}

def generar_config_dispositivo(username):
    return Client(
        settings={},
        user_agent=f"Instagram 155.0.0.37.107 Android (28/9; 420dpi; 1080x1920; Xiaomi; Redmi Note; lavender; qcom; es_MX)"
    )

def cargar_proxies():
    if not os.path.exists(PROXIES_FILE):
        return []
    with open(PROXIES_FILE, "r") as f:
        proxies = [line.strip() for line in f if line.strip()]
    return proxies

def convertir_proxy(proxy_str):
    if "@" in proxy_str:
        auth, ip_port = proxy_str.split("@")
        user, pwd = auth.split(":")
        ip, port = ip_port.split(":")
        return f"http://{user}:{pwd}@{ip}:{port}"
    return f"http://{proxy_str}"

def probar_proxy(proxy_str):
    try:
        proxy = {"http": proxy_str, "https": proxy_str}
        r = requests.get("https://www.instagram.com", proxies=proxy, timeout=5)
        return r.status_code == 200
    except:
        return False

def guardar_sesion(cl: Client, username):
    path = os.path.join(SESSIONS_DIR, f"ig_session_{username}.json")
    with open(path, "w") as f:
        json.dump(cl.get_settings(), f)
    usuarios_activos[username] = cl

def restaurar_sesion(username):
    path = os.path.join(SESSIONS_DIR, f"ig_session_{username}.json")
    if not os.path.exists(path):
        return None
    cl = generar_config_dispositivo(username)
    with open(path, "r") as f:
        cl.set_settings(json.load(f))
    try:
        cl.get_timeline_feed()
        usuarios_activos[username] = cl
        return cl
    except Exception:
        return None

def login_instagram(username, password):
    cl = generar_config_dispositivo(username)
    proxies = cargar_proxies()

    def intentar_login(proxy=None):
        if proxy:
            proxy_url = convertir_proxy(proxy)
            if not probar_proxy(proxy_url):
                return None
            cl.set_proxy(proxy_url)

        try:
            cl.login(username, password)
            guardar_sesion(cl, username)
            return cl
        except ChallengeRequired:
            logger.warning(f"Desafío requerido para {username}, esperando verificación...")
            for _ in range(9):
                time.sleep(10)
                try:
                    cl.get_timeline_feed()
                    guardar_sesion(cl, username)
                    return cl
                except Exception:
                    continue
            raise Exception("Verificación requerida, no completada a tiempo.")
        except PleaseWaitFewMinutes:
            logger.warning("Instagram pidió esperar unos minutos. Reintentando...")
            time.sleep(60)
            return None
        except ClientError as e:
            raise Exception(f"Error al iniciar sesión: {e}")
        except Exception as e:
            raise Exception(f"Fallo general: {e}")

    # 1. Primer intento sin proxy
    cl.set_proxy(None)
    try:
        cl.login(username, password)
        guardar_sesion(cl, username)
        return cl
    except:
        pass

    # 2. Reintento con proxy
    for proxy in proxies:
        cl = generar_config_dispositivo(username)
        resultado = intentar_login(proxy)
        if resultado:
            return resultado

    raise Exception("No se pudo iniciar sesión ni con proxy.")

def guardar_cuenta_api(username, password):
    cuentas = []
    if os.path.exists(CUENTAS_FILE):
        with open(CUENTAS_FILE, "r") as f:
            cuentas = json.load(f)

    cuentas = [c for c in cuentas if c["username"] != username]
    cuentas.append({"username": username, "password": password})

    with open(CUENTAS_FILE, "w") as f:
        json.dump(cuentas, f, indent=2)

def cerrar_sesion(username):
    if username in usuarios_activos:
        usuarios_activos.pop(username)
    path = os.path.join(SESSIONS_DIR, f"ig_session_{username}.json")
    if os.path.exists(path):
        os.remove(path)

def cuentas_activas():
    return list(usuarios_activos.keys())

def cliente_por_usuario(username):
    return usuarios_activos.get(username)

def buscar_usuario(username):
    bot = usuarios_activos.get("kraveaibot")
    if not bot:
        raise Exception("kraveaibot no está activo")
    user = bot.user_info_by_username(username)
    return {
        "username": user.username,
        "full_name": user.full_name,
        "profile_pic_url": user.profile_pic_url,
        "is_verified": user.is_verified,
        "follower_count": user.follower_count
    }
