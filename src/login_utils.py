# ~/kraveai-backend/src/login_utils.py
import os
from instagrapi import Client
from instagrapi.exceptions import LoginRequired, ClientError

COOKIE_FILE = "ig_session.json"
USERNAME = os.getenv("IG_USERNAME")
PASSWORD = os.getenv("INSTAGRAM_PASS")


def login_instagram():
    """
    Inicia sesión en Instagram con las credenciales del .env
    Si ya existe ig_session.json, intenta restaurar sesión.
    """
    if not USERNAME or not PASSWORD:
        raise ValueError("❌ IG_USERNAME o INSTAGRAM_PASS no están configuradas en el entorno (.env)")

    cl = Client()
    cl.delay_range = [2, 5]  # Evita sospecha por bots

    # 🔁 Intenta restaurar sesión si existe ig_session.json
    if os.path.exists(COOKIE_FILE):
        try:
            cl.load_settings(COOKIE_FILE)
            cl.get_timeline_feed()  # Si no falla, la sesión es válida
            print(f"✅ Sesión restaurada correctamente como @{cl.username}")
            return cl
        except LoginRequired:
            print("⚠️ La sesión anterior ha expirado, se intentará login manual.")
        except ClientError as e:
            print(f"⚠️ Error al restaurar sesión anterior: {e}")
        except Exception as e:
            print(f"⚠️ Falló restaurar sesión por error inesperado: {e}")

    # 🔑 Si no hay sesión válida, login manual
    try:
        cl.login(USERNAME, PASSWORD)
        cl.dump_settings(COOKIE_FILE)
        print(f"✅ Login exitoso como @{USERNAME}")
        return cl
    except ClientError as e:
        print(f"❌ Error de Instagram (ClientError): {e}")
        return None
    except Exception as e:
        print(f"❌ Error inesperado en login: {e}")
        return None
