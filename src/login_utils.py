import os
import random
from instagrapi import Client
from pathlib import Path
from instagrapi.exceptions import LoginRequired, BadPassword, PleaseWaitFewMinutes

# 📂 Sesiones fuera de src por seguridad
SESSION_FILE = Path(__file__).resolve().parent.parent / "sesiones" / "ig_session_kraveaibot.json"
PROXY_FILE = Path(__file__).resolve().parent / "proxies" / "proxies.txt"

USERNAME = os.getenv("IG_USERNAME")
PASSWORD = os.getenv("INSTAGRAM_PASS")


def load_proxies():
    """Carga proxies desde proxies.txt y normaliza formato"""
    proxies = []
    if PROXY_FILE.exists():
        with open(PROXY_FILE, "r") as f:
            for line in f:
                line = line.strip()
                if line:
                    if line.count(":") == 3:  # host:port:user:pass
                        host, port, user, pwd = line.split(":")
                        proxy_str = f"http://{user}:{pwd}@{host}:{port}"
                    elif "@" in line:
                        proxy_str = f"http://{line}"
                    else:
                        proxy_str = f"http://{line}"
                    proxies.append(proxy_str)
                    print(f"🔌 Proxy transformado: {line} → {proxy_str}")
    return proxies


def random_proxy(proxies):
    return random.choice(proxies) if proxies else None


def login_instagram():
    if not USERNAME or not PASSWORD:
        print("❌ Faltan IG_USERNAME o INSTAGRAM_PASS en .env")
        return None

    cl = Client()
    cl.delay_range = [3, 7]

    proxies = load_proxies()
    proxy = random_proxy(proxies)
    if proxy:
        try:
            cl.set_proxy(proxy)
            print(f"🌐 Proxy activado: {proxy}")
        except Exception as e:
            print(f"⚠️ Proxy inválido: {e} — usando IP local")

    if SESSION_FILE.exists():
        try:
            cl.load_settings(SESSION_FILE)
            cl.get_timeline_feed()
            print(f"✅ Sesión restaurada como @{cl.username}")
            return cl
        except Exception as e:
            print(f"⚠️ Sesión corrupta eliminada: {e}")
            SESSION_FILE.unlink(missing_ok=True)

    try:
        print(f"➡️ Iniciando sesión como @{USERNAME}")
        cl.login(USERNAME, PASSWORD)
        cl.dump_settings(SESSION_FILE)
        print(f"✅ Login exitoso @{cl.username}")
        return cl
    except BadPassword:
        print("❌ Contraseña incorrecta.")
    except PleaseWaitFewMinutes:
        print("⏳ Instagram pide esperar. Cambia IP o proxy.")
    except LoginRequired:
        print("🔐 Instagram requiere login manual. Borra sesión y reintenta.")
    except Exception as e:
        print(f"❌ Error inesperado: {str(e)}")

    return None
