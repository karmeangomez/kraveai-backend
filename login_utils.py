# login_utils.py - Login con cookies o credenciales

import os
from instagrapi import Client

COOKIE_FILE = "ig_session.json"
USERNAME = os.getenv("IG_USERNAME")
PASSWORD = os.getenv("INSTAGRAM_PASS")

def login_instagram():
    cl = Client()
    cl.delay_range = [2, 5]

    if os.path.exists(COOKIE_FILE):
        try:
            cl.load_settings(COOKIE_FILE)
            cl.get_timeline_feed()
            print("✅ Sesión restaurada desde cookies.")
            return cl
        except Exception as e:
            print("⚠️ Falló restaurar sesión, intentando login...", e)

    try:
        cl.login(USERNAME, PASSWORD)
        cl.dump_settings(COOKIE_FILE)
        print(f"✅ Login exitoso como @{USERNAME}")
        return cl
    except Exception as e:
        print("❌ Error en login:", e)
        return None

