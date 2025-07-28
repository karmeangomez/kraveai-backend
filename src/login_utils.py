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
    if not proxies:
        return None

    raw = random.choice(proxies)
    try:
        host, port, user, password = raw.split(":")
        return f"http://{user}:{password}@{host}:{port}"
    except Exception as e:
        print(f"❌ Proxy malformado: {raw}")
        return None

def login_instagram(username, password):
    cl = Client()
    proxy_url = obtener_proxy_aleatorio()
    if proxy_url:
        cl.set_proxy(proxy_url)

    try:
        cl.login(username, password)
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

def restaurar_sesion(username, password):
    path = f"ig_session_{username}.json"
    cl = Client()
    proxy_url = obtener_proxy_aleatorio()
    if proxy_url:
        cl.set_proxy(proxy_url)

    if os.path.exists(path):
        try:
            with open(path, "r") as f:
                cl.set_settings(json.load(f))
            cl.login(username, password)
            return cl
        except Exception:
            print(f"⚠️ Falló restauración desde {path}, intentando login manual...")

    # Si no se puede restaurar, intenta login normal
    return login_instagram(username, password)

def verificar_sesion(cl, username):
    try:
        user_id = cl.user_id_from_username(username)
        return True if user_id else False
    except LoginRequired:
        return False
    except Exception:
        return False
