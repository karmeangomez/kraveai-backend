import os
from instagrapi import Client
from instagrapi.exceptions import LoginRequired, ClientError

# Path absoluto para la cookie
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
COOKIE_FILE = os.path.join(SCRIPT_DIR, "ig_session.json")

USERNAME = os.getenv("IG_USERNAME")
PASSWORD = os.getenv("INSTAGRAM_PASS")


def login_instagram():
    if not USERNAME or not PASSWORD:
        raise ValueError("❌ IG_USERNAME o INSTAGRAM_PASS no configuradas en .env")

    cl = Client()
    cl.delay_range = [2, 5]

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
            raise Exception("Login incompleto: falta ds_user_id o sessionid")
        cl.dump_settings(COOKIE_FILE)
        print(f"✅ Login exitoso como @{cl.username}")
        return cl
    except Exception as e:
        print(f"❌ Error en login: {str(e)}")
        return None
