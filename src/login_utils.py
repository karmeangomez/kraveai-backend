import os
import json
import time
import random
import logging
import requests
from instagrapi import Client
from instagrapi.exceptions import (
    ChallengeRequired, PleaseWaitFewMinutes,
    LoginRequired, ClientError
)
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

SESSIONS_DIR = "src/sessions"
KRAVEAIBOT_DIR = os.path.join(SESSIONS_DIR, "kraveaibot")
USUARIOS_DIR = os.path.join(SESSIONS_DIR, "usuarios")
PROXIES_FILE = "src/proxies/proxies.txt"
CUENTAS_FILE = "cuentas_creadas.json"

# Crear directorios si no existen
for path in [SESSIONS_DIR, KRAVEAIBOT_DIR, USUARIOS_DIR]:
    os.makedirs(path, exist_ok=True)

usuarios_activos = {}

def generar_config_dispositivo(username):
    cl = Client()
    cl.set_locale("es_MX")
    cl.set_device(
        app_version="155.0.0.37.107",
        android_version=28,
        android_release="9.0",
        dpi=420,
        resolution="1080x1920",
        manufacturer="Xiaomi",
        model="Redmi Note",
        device="lavender"
    )
    return cl

def cargar_proxies():
    if not os.path.exists(PROXIES_FILE):
        return []
    with open(PROXIES_FILE, "r") as f:
        return [line.strip() for line in f if line.strip()]

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

def path_sesion(username):
    if username == "kraveaibot":
        return os.path.join(KRAVEAIBOT_DIR, f"ig_session_{username}.json")
    return os.path.join(USUARIOS_DIR, f"ig_session_{username}.json")

def guardar_sesion(cl: Client, username):
    path = path_sesion(username)
    with open(path, "w") as f:
        json.dump(cl.get_settings(), f)
    usuarios_activos[username] = cl

def restaurar_sesion(username):
    path = path_sesion(username)
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
            logger.warning(f"🔐 Desafío requerido para {username}. Esperando verificación manual...")
            for _ in range(9):
                time.sleep(10)
                try:
                    cl.get_timeline_feed()
                    guardar_sesion(cl, username)
                    return cl
                except:
                    continue
            raise Exception("⚠️ Verificación manual no completada a tiempo.")
        except PleaseWaitFewMinutes:
            logger.warning("⏳ Instagram pidió esperar. Reintentando después de un minuto...")
            time.sleep(60)
            return None
        except ClientError as e:
            raise Exception(f"❌ Error de cliente: {e}")
        except Exception as e:
            raise Exception(f"❌ Error inesperado: {e}")

    # Intento sin proxy
    try:
        cl.login(username, password)
        guardar_sesion(cl, username)
        return cl
    except:
        pass

    # Reintento con proxies
    for proxy in proxies:
        cl = generar_config_dispositivo(username)
        resultado = intentar_login(proxy)
        if resultado:
            return resultado

    raise Exception("❌ No se pudo iniciar sesión ni con ni sin proxy.")

def guardar_cuenta_api(username, password):
    if username == "kraveaibot":
        return  # No guardar kraveaibot en cuentas_creadas.json

    cuentas = []
    if os.path.exists(CUENTAS_FILE):
        with open(CUENTAS_FILE, "r") as f:
            cuentas = json.load(f)
    cuentas = [c for c in cuentas if c["username"] != username]
    cuentas.append({"username": username, "password": password})
    with open(CUENTAS_FILE, "w") as f:
        json.dump(cuentas, f, indent=2)

def cerrar_sesion(username):
    usuarios_activos.pop(username, None)
    path = path_sesion(username)
    if os.path.exists(path):
        os.remove(path)

def cuentas_activas():
    return list(usuarios_activos.keys())

def cliente_por_usuario(username):
    return usuarios_activos.get(username)

def buscar_usuario(username):
    bot = usuarios_activos.get("kraveaibot")
    if not bot:
        raise Exception("❌ kraveaibot no está activo.")
    user = bot.user_info_by_username(username)
    return {
        "username": user.username,
        "full_name": user.full_name,
        "profile_pic_url": user.profile_pic_url,
        "is_verified": user.is_verified,
        "follower_count": user.follower_count
    }
