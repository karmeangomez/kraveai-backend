# instagram_utils.py — Unifica login y creación de cuenta Instagram

import os
import json
from instagrapi import Client
from crearCuentaInstagram import crearCuentaInstagram

COOKIE_FILE = "ig_session.json"
USERNAME = os.getenv("IG_USERNAME")
PASSWORD = os.getenv("INSTAGRAM_PASS")

def iniciar_sesion():
    cl = Client()
    cl.delay_range = [2, 5]

    if os.path.exists(COOKIE_FILE):
        try:
            cl.load_settings(COOKIE_FILE)
            cl.get_timeline_feed()
            print("✅ Sesión restaurada desde cookies.")
            return cl
        except Exception as e:
            print(f"⚠️ Error cargando cookies: {e}")

    try:
        cl.login(USERNAME, PASSWORD)
        with open(COOKIE_FILE, "w") as f:
            f.write(json.dumps(cl.get_settings()))
        print("🔐 Login exitoso. Cookies guardadas.")
        return cl
    except Exception as e:
        print(f"❌ Login fallido: {e}")
        return None

def crear_cuenta_instagram(client=None):
    return crearCuentaInstagram()
