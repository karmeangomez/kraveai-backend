import os
import random
import json
import time
from instagrapi import Client
from instagrapi.exceptions import ChallengeRequired, LoginRequired
from dotenv import load_dotenv

load_dotenv()
PROXY_FILE = "src/proxies/proxies.txt"
MAX_REINTENTOS = 5
ESPERA_VERIFICACION = 60  # segundos para ir a la app y aprobar

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
        except Exception as e:
            print(f"❌ Proxy malformado: {raw_proxy}")
            continue

        print(f"🔌 Intento {intentos} con proxy {host}:{port}")
        try:
            cl.login(username, password)
            print(f"✅ Login exitoso para {username}")
            return cl
        except ChallengeRequired:
            print(f"⚠️ Desafío requerido para {username}")
            print(f"⏳ Esperando {ESPERA_VERIFICACION} segundos para que apruebes en la app...")
            time.sleep(ESPERA_VERIFICACION)
            try:
                cl.get_timeline_feed()  # intentamos forzar sesión válida
                print(f"✅ Sesión validada tras desafío para {username}")
                return cl
            except Exception as e:
                print(f"❌ Aún no validado: {e}")
                return None
        except Exception as e:
            print(f"❌ Error con proxy {raw_proxy}: {e}")
            continue

    print(f"❌ Fallaron todos los proxies para {username}")
    return None

def guardar_sesion(cl, username):
    path = f"ig_session_{username}.json"
    with open(path, "w") as f:
        json.dump(cl.get_settings(), f)

def restaurar_sesion(username, password):
    path = f"ig_session_{username}.json"
    cl = Client()
    proxies = obtener_proxies()
    random.shuffle(proxies)

    if os.path.exists(path):
        try:
            with open(path, "r") as f:
                cl.set_settings(json.load(f))
            cl.login(username, password)
            return cl
        except Exception as e:
            print(f"⚠️ Falló restauración desde {path}, reintentando login manual...")

    return login_instagram(username, password)

def verificar_sesion(cl, username):
    try:
        user_id = cl.user_id_from_username(username)
        return True if user_id else False
    except LoginRequired:
        return False
    except Exception:
        return False
