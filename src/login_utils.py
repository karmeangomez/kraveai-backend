import os
import random
import json
from instagrapi import Client
from instagrapi.exceptions import ChallengeRequired, LoginRequired
from dotenv import load_dotenv

load_dotenv()
PROXY_FILE = "src/proxies/proxies.txt"

def obtener_proxies():
    if not os.path.exists(PROXY_FILE):
        return []
    with open(PROXY_FILE, "r") as f:
        return [line.strip() for line in f if line.strip()]

def guardar_sesion(cl, username):
    path = f"ig_session_{username}.json"
    with open(path, "w") as f:
        json.dump(cl.get_settings(), f, default=str)

def login_instagram(username, password):
    # Primer intento SIN proxy
    print("🌐 Intentando login sin proxy...")
    cl = Client()
    try:
        cl.login(username, password)
        print(f"✅ Login exitoso SIN proxy para {username}")
        guardar_sesion(cl, username)
        return cl
    except ChallengeRequired:
        print(f"⚠️ Desafío requerido para {username} (sin proxy), espera confirmación en la app.")
        return None
    except Exception as e:
        print(f"❌ Error sin proxy: {e}")

    # Si falló, intenta con proxies
    proxies = obtener_proxies()
    random.shuffle(proxies)
    for raw_proxy in proxies:
        cl = Client()
        try:
            host, port, user, password_proxy = raw_proxy.split(":")
            proxy_url = f"http://{user}:{password_proxy}@{host}:{port}"
            cl.set_proxy(proxy_url)
            print(f"🔁 Intentando con proxy {host}:{port}")
            cl.login(username, password)
            print(f"✅ Login exitoso con proxy para {username}")
            guardar_sesion(cl, username)
            return cl
        except ChallengeRequired:
            print(f"⚠️ Desafío con proxy para {username}")
            return None
        except Exception as e:
            print(f"❌ Falló proxy {raw_proxy}: {e}")
            continue

    print(f"❌ Todos los intentos fallaron para {username}")
    return None

def restaurar_sesion(username, password):
    path = f"ig_session_{username}.json"
    cl = Client()
    if os.path.exists(path):
        try:
            with open(path, "r") as f:
                cl.set_settings(json.load(f))
            cl.login(username, password)
            print(f"♻️ Sesión restaurada para {username}")
            return cl
        except Exception:
            print(f"⚠️ Falló restaurar sesión de {username}")
    return login_instagram(username, password)

def verificar_sesion(cl, username):
    try:
        user_id = cl.user_id_from_username(username)
        return True if user_id else False
    except LoginRequired:
        return False
    except Exception:
        return False
