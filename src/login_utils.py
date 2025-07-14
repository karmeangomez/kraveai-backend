import os
import json
from instagrapi import Client
from instagrapi.exceptions import LoginRequired, ClientError

def login_instagram(username, password, session_file):
    cl = Client()
    cl.delay_range = [3, 6]
    if os.path.exists(session_file):
        try:
            cl.load_settings(session_file)
            cl.get_timeline_feed()
            print(f"✅ Sesión restaurada {username}")
            return cl
        except LoginRequired:
            print(f"⚠️ Sesión expirada para {username}, reintentando login.")
    try:
        cl.login(username, password)
        cl.dump_settings(session_file)
        print(f"✅ Login correcto como {username}")
        return cl
    except Exception as e:
        print(f"❌ Error login {username}: {e}")
        return None


def iniciar_cuentas_guardadas():
    path = os.path.join(os.path.dirname(__file__), "..", "cuentas_creadas.json")
    if not os.path.exists(path):
        print("⚠️ No se encontró cuentas_creadas.json")
        return []

    with open(path, "r", encoding="utf-8") as f:
        cuentas = json.load(f)

    clientes = []

    for cuenta in cuentas:
        username = cuenta["usuario"]
        password = cuenta["contrasena"]
        session_file = f"ig_session_{username}.json"
        client = login_instagram(username, password, session_file)
        if client:
            clientes.append({
                "username": username,
                "client": client
            })

    return clientes