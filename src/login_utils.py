import os
from instagrapi import Client
from instagrapi.exceptions import LoginRequired, BadPassword, PleaseWaitFewMinutes
from pathlib import Path

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SESIONES_DIR = os.path.join(SCRIPT_DIR, "sesiones")
os.makedirs(SESIONES_DIR, exist_ok=True)
SESSION_FILE = os.path.join(SESIONES_DIR, "ig_session_kraveaibot.json")

USERNAME = os.getenv("IG_USERNAME")
PASSWORD = os.getenv("INSTAGRAM_PASS")


def is_session_valid(client):
    try:
        client.get_timeline_feed()
        return True
    except Exception:
        return False


def login_instagram():
    if not USERNAME or not PASSWORD:
        print("❌ IG_USERNAME o INSTAGRAM_PASS no configuradas en .env")
        return None

    cl = Client()
    cl.delay_range = [3, 7]  # Evita spam y simula humano

    # Intenta cargar la sesión
    if os.path.exists(SESSION_FILE):
        try:
            cl.load_settings(SESSION_FILE)
            if is_session_valid(cl):
                print(f"✅ Sesión restaurada como @{cl.username}")
                return cl
            else:
                print("⚠️ Sesión inválida, eliminando archivo.")
                os.remove(SESSION_FILE)
        except Exception as e:
            print(f"⚠️ Error cargando sesión: {str(e)}")
            os.remove(SESSION_FILE)

    # Si no hay sesión válida, hace login limpio
    try:
        print(f"➡️ Iniciando sesión para @{USERNAME} (sin proxy)")
        cl.login(USERNAME, PASSWORD)
        cl.dump_settings(SESSION_FILE)
        print(f"✅ Login exitoso como @{cl.username}")
        return cl
    except BadPassword:
        print("❌ Contraseña incorrecta.")
    except PleaseWaitFewMinutes:
        print("🚫 Instagram pide esperar unos minutos. Cambia tu IP.")
    except LoginRequired:
        print("🔑 Instagram requiere nuevo inicio de sesión.")
    except Exception as e:
        print(f"❌ Error desconocido: {str(e)}")

    return None
