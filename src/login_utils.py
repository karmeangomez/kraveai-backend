import os
import json
from instagrapi import Client
from instagrapi.exceptions import LoginRequired, ClientError
from dotenv import load_dotenv

load_dotenv(".env")


def login_instagram(username, password, save_cookie_as):
    """Inicia sesión individual y guarda la sesión en archivo único."""
    cl = Client()
    cl.delay_range = [2, 5]

    if os.path.exists(save_cookie_as):
        try:
            cl.load_settings(save_cookie_as)
            cl.get_timeline_feed()
            print(f"✅ Sesión restaurada desde {save_cookie_as}")
            return cl
        except (LoginRequired, ClientError):
            print(f"⚠️ Sesión expirada en {save_cookie_as}, intentando login manual...")
        except Exception as e:
            print(f"⚠️ Restauración fallida {save_cookie_as}: {e}")

    try:
        cl.login(username, password)
        cl.dump_settings(save_cookie_as)
        print(f"✅ Login exitoso como @{username} guardado en {save_cookie_as}")
        return cl
    except Exception as e:
        print(f"❌ Falló login @{username}: {e}")
        return None


def cargar_cuentas_guardadas():
    path = os.path.join(os.path.dirname(__file__), "../cuentas_creadas.json")
    if not os.path.exists(path):
        return []

    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)
