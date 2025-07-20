import os
import random
from instagrapi import Client
from pathlib import Path
from instagrapi.exceptions import LoginRequired, BadPassword, PleaseWaitFewMinutes

SESSION_FILE = Path(__file__).resolve().parent.parent / "sesiones" / "ig_session_kraveaibot.json"
PROXY_FILE = Path(__file__).resolve().parent / "proxies" / "proxies.txt"

USERNAME = os.getenv("IG_USERNAME")
PASSWORD = os.getenv("INSTAGRAM_PASS")


def load_proxies():
    proxies = []
    if PROXY_FILE.exists():
        with open(PROXY_FILE, "r") as f:
            proxies = [f"http://{line.strip()}" for line in f if line.strip()]
    return proxies


def random_proxy(proxies):
    return random.choice(proxies) if proxies else None


def login_instagram():
    if not USERNAME or not PASSWORD:
        print("❌ IG_USERNAME o INSTAGRAM_PASS no configuradas en .env")
        return None

    cl = Client()
    cl.delay_range = [3, 7]

    proxies = load_proxies()
    proxy = random_proxy(proxies)
    if proxy:
        cl.set_proxy(proxy)
        print(f"🌐 Proxy asignado: {proxy}")
    else:
        print("⚠️ No se encontraron proxies, usando IP local")

    if SESSION_FILE.exists():
        try:
            cl.load_settings(SESSION_FILE)
            cl.get_timeline_feed()
            print(f"✅ Sesión restaurada como @{cl.username}")
            return cl
        except Exception as e:
            print(f"⚠️ Sesión dañada: {e}, eliminando...")
            SESSION_FILE.unlink(missing_ok=True)

    try:
        print(f"➡️ Iniciando sesión como @{USERNAME}")
        cl.login(USERNAME, PASSWORD)
        cl.dump_settings(SESSION_FILE)
        print(f"✅ Login exitoso como @{cl.username}")
        return cl
    except BadPassword:
        print("❌ Contraseña incorrecta.")
    except PleaseWaitFewMinutes:
        print("🚫 IP bloqueada temporalmente. Cambia IP o usa proxy.")
    except LoginRequired:
        print("🔐 Sesión caducada, requiere login manual.")
    except Exception as e:
        print(f"❌ Otro error: {e}")

    return None
