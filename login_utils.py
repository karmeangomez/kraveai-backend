# login_utils.py - Login a Instagram usando instagrapi y guardar cookies

import os
from instagrapi import Client
from dotenv import load_dotenv

load_dotenv()

IG_USERNAME = os.getenv("IG_USERNAME")
INSTAGRAM_PASS = os.getenv("INSTAGRAM_PASS")
COOKIES_PATH = "ig_session.json"

def iniciar_sesion():
    cl = Client()

    if os.path.exists(COOKIES_PATH):
        try:
            cl.load_settings(COOKIES_PATH)
            cl.get_timeline_feed()
            print("✅ Sesion restaurada desde cookies.")
            return cl
        except Exception as e:
            print(f"⚠️ No se pudo restaurar la sesion: {e}")

    try:
        cl.login(IG_USERNAME, INSTAGRAM_PASS)
        cl.dump_settings(COOKIES_PATH)
        print(f"✅ Login exitoso como @{IG_USERNAME}")
        return cl
    except Exception as e:
        print(f"❌ Error iniciando sesion: {e}")
        return None

if __name__ == "__main__":
    iniciar_sesion()
