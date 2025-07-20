import os
import random
from instagrapi import Client

# Paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
COOKIE_FILE = os.path.join(SCRIPT_DIR, "ig_session.json")
PROXY_FILE = os.path.join(SCRIPT_DIR, "src", "proxies", "proxies.txt")

USERNAME = os.getenv("IG_USERNAME")
PASSWORD = os.getenv("INSTAGRAM_PASS")


def load_proxies():
    """Lee todos los proxies desde proxies.txt"""
    proxies = []
    if os.path.exists(PROXY_FILE):
        with open(PROXY_FILE, "r") as f:
            proxies = [f"http://{line.strip()}" for line in f if line.strip()]
    return proxies


def random_proxy(proxies):
    """Devuelve un proxy aleatorio"""
    return random.choice(proxies) if proxies else None


def login_instagram():
    if not USERNAME or not PASSWORD:
        print("❌ IG_USERNAME o INSTAGRAM_PASS no configuradas en .env")
        return None

    cl = Client()
    cl.delay_range = [2, 6]

    proxies = load_proxies()
    proxy = random_proxy(proxies)
    if proxy:
        cl.set_proxy(proxy)
        print(f"🌐 Proxy asignado: {proxy}")
    else:
        print("⚠️ No se encontraron proxies, se usará IP local")

    if os.path.exists(COOKIE_FILE):
        try:
            cl.load_settings(COOKIE_FILE)
            user_id = cl.user_id
            if user_id:
                print(f"✅ Sesión restaurada como @{cl.username}")
                return cl
        except Exception as e:
            print(f"⚠️ Error cargando sesión: {str(e)}")

    try:
        cl.login(USERNAME, PASSWORD)
        auth_data = cl.get_settings().get("authorization_data", {})
        if not auth_data.get("ds_user_id") or not auth_data.get("sessionid"):
            print("❌ Login incompleto: falta ds_user_id o sessionid")
            return None
        cl.dump_settings(COOKIE_FILE)
        print(f"✅ Login exitoso como @{cl.username}")
        return cl
    except Exception as e:
        print(f"❌ Error en login: {str(e)}")
        return None
