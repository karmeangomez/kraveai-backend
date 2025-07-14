import os
import json
from instagrapi import Client
from instagrapi.exceptions import LoginRequired, ClientError

def login_instagram(username, password, session_file=None):
    cl = Client()
    cl.delay_range = [2, 5]

    if session_file and os.path.exists(session_file):
        try:
            cl.load_settings(session_file)
            cl.get_timeline_feed()
            print(f"✅ Sesión restaurada correctamente como @{cl.username}")
            return cl
        except (LoginRequired, ClientError):
            pass
        except Exception as e:
            print(f"⚠️ Falló restaurar sesión {session_file}: {e}")

    try:
        cl.login(username, password)
        if session_file:
            cl.dump_settings(session_file)
        print(f"✅ Login exitoso como @{username}")
        return cl
    except Exception as e:
        print(f"❌ Login fallido @{username}: {e}")
        return None


def cargar_todas_cuentas():
    cuentas = []
    if os.path.exists("cuentas_creadas.json"):
        with open("cuentas_creadas.json", "r", encoding="utf-8") as f:
            cuentas = json.load(f)

    sesiones = {}
    for cuenta in cuentas:
        usuario = cuenta["usuario"]
        contrasena = cuenta["contrasena"]
        session_file = f"ig_session_{usuario}.json"
        cl = login_instagram(usuario, contrasena, session_file=session_file)
        if cl:
            sesiones[usuario] = cl
    return sesiones