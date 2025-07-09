# ~/kraveai-backend/src/login_utils.py
import os
from instagrapi import Client
from instagrapi.exceptions import LoginRequired, ClientError

COOKIE_FILE = "ig_session.json"
USERNAME = os.getenv("IG_USERNAME")
PASSWORD = os.getenv("INSTAGRAM_PASS")

def login_instagram():
    cl = Client()
    cl.delay_range = [2, 5]

    if not USERNAME or not PASSWORD:
        print("❌ Error: IG_USERNAME o INSTAGRAM_PASS no están configuradas en el entorno.")
        return None

    if os.path.exists(COOKIE_FILE):
        try:
            cl.load_settings(COOKIE_FILE)
            cl.get_timeline_feed()
            print("✅ Sesión restaurada desde cookies.")
            return cl
        except LoginRequired:
            print("⚠️ Sesión expirada, intentando login...")
        except ClientError as e:
            print(f"⚠️ Error al cargar sesión: {e}")
        except Exception as e:
            print(f"⚠️ Falló restaurar sesión: {e}")

    try:
        cl.login(USERNAME, PASSWORD)
        cl.dump_settings(COOKIE_FILE)
        print(f"✅ Login exitoso como @{USERNAME}")
        return cl
    except ClientError as e:
        print(f"❌ Error en login: {e}")
        return None
    except Exception as e:
        print(f"❌ Error inesperado en login: {e}")
        return None
