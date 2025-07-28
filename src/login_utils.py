import os
import random
import json
from instagrapi import Client
from instagrapi.exceptions import ChallengeRequired, LoginRequired
from dotenv import load_dotenv

load_dotenv()
PROXY_FILE = "src/proxies/proxies.txt"

def obtener_proxy_aleatorio():
    if not os.path.exists(PROXY_FILE):
        return None
    with open(PROXY_FILE, "r") as f:
        proxies = [line.strip() for line in f if line.strip()]
    return random.choice(proxies) if proxies else None

def login_instagram(username, password):
    cl = Client()
    proxy = obtener_proxy_aleatorio()
    if proxy:
        cl.set_proxy(proxy)
    try:
        print(f"🔐 Iniciando sesión para: {username}...")
        cl.login(username, password)
        print(f"✅ Sesión iniciada correctamente para {username}")
        return cl
    except ChallengeRequired:
        print(f"❌ Desafío requerido para {username}")
        return None
    except Exception as e:
        print(f"❌ Error al iniciar sesión: {e}")
        return None

def guardar_sesion(cl, username):
    path = f"ig_session_{username}.json"
    with open(path, "w") as f:
        json.dump(cl.get_settings(), f)
    print(f"💾 Sesión guardada en {path}")

def restaurar_sesion(username, password):
    path = f"ig_session_{username}.json"
    cl = Client()
    proxy = obtener_proxy_aleatorio()
    if proxy:
        cl.set_proxy(proxy)

    if os.path.exists(path):
        try:
            with open(path, "r") as f:
                cl.set_settings(json.load(f))
            cl.login(username, password)
            print(f"🔄 Sesión restaurada desde {path}")
            return cl
        except Exception:
            print(f"⚠️ Falló restauración desde {path}, intentando login manual...")

    return login_instagram(username, password)

def verificar_sesion(cl, username):
    try:
        user_id = cl.user_id_from_username(username)
        return True if user_id else False
    except LoginRequired:
        return False
