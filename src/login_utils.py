import os
from instagrapi import Client
from dotenv import load_dotenv
from pathlib import Path

# Cargar .env
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

USERNAME = os.getenv("IG_USERNAME")
PASSWORD = os.getenv("INSTAGRAM_PASS")

SESSION_FILE = BASE_DIR / "sesiones" / f"ig_session_{USERNAME}.json"

def login_instagram():
    cl = Client()
    cl.delay_range = [3, 7]  # Más humano
    # Aplica proxy residencial
    cl.set_proxy(f"http://{os.getenv('WEBSHARE_RESIDENTIAL_USER')}:{os.getenv('WEBSHARE_RESIDENTIAL_PASS')}@p.webshare.io:80")

    if SESSION_FILE.exists():
        try:
            cl.load_settings(SESSION_FILE)
            cl.get_timeline_feed()
            print(f"✅ Sesión restaurada como @{cl.username}")
            return cl
        except Exception as e:
            print(f"⚠️ Sesión inválida, eliminando: {e}")
            SESSION_FILE.unlink()

    try:
        cl.login(USERNAME, PASSWORD)
        cl.dump_settings(SESSION_FILE)
        print(f"✅ Login exitoso como @{cl.username}")
        return cl
    except Exception as e:
        print(f"❌ Error en login: {e}")
        return None


def is_session_valid(cl):
    try:
        cl.get_timeline_feed()
        return True
    except Exception:
        return False
