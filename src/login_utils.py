import os
import random
import json
import pickle
from instagrapi import Client
from instagrapi.exceptions import ChallengeRequired, LoginRequired
from dotenv import load_dotenv

load_dotenv()
PROXY_FILE = "src/proxies/proxies.txt"
MAX_REINTENTOS = 5

def obtener_proxies():
    if not os.path.exists(PROXY_FILE):
        return []
    with open(PROXY_FILE, "r") as f:
        return [line.strip() for line in f if line.strip()]

def login_instagram(username, password):
    proxies = obtener_proxies()
    random.shuffle(proxies)
    intentos = 0

    for raw_proxy in proxies:
        intentos += 1
        cl = Client()
        try:
            host, port, user, password_proxy = raw_proxy.split(":")
            proxy_url = f"http://{user}:{password_proxy}@{host}:{port}"
            cl.set_proxy(proxy_url)
        except Exception:
            print(f"❌ Proxy malformado: {raw_proxy}")
            continue

        print(f"🔌 Intento {intentos} con proxy {host}:{port}")
        try:
            cl.login(username, password)
            print(f"✅ Login exitoso para {username}")
            return cl
        except ChallengeRequired:
            print(f"⚠️ Desafío requerido para {username}, ve a aprobar en la app.")
            return None
        except Exception as e:
            print(f"❌ Error con proxy {raw_proxy}: {e}")
            continue

    print(f"❌ Fallaron todos los proxies para {username}")
    return None

def guardar_sesion(cl, username):
    path = f"ig_session_{username}.pkl"
    try:
        with open(path, "wb") as f:
            pickle.dump(cl.get_settings(), f)
        print(f"💾 Sesión guardada para {username}")
    except Exception as e:
        print(f"❌ Error al guardar sesión de {username}: {e}")

def restaurar_sesion(username, password):
    path = f"ig_session_{username}.pkl"
    cl = Client()
    proxies = obtener_proxies()
    random.shuffle(proxies)

    if os.path.exists(path):
        try:
            with open(path, "rb") as f:
                settings = pickle.load(f)
                cl.set_settings(settings)
            cl.login(username, password)
            print(f"♻️ Sesión restaurada desde archivo para {username}")
            return cl
        except Exception as e:
            print(f"⚠️ Falló restauración desde .pkl: {e}. Intentando login normal...")

    return login_instagram(username, password)

def verificar_sesion(cl, username):
    try:
        user_id = cl.user_id_from_username(username)
        return True if user_id else False
    except LoginRequired:
        return False
    except Exception:
        return False
