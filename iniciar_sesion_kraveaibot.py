import os
import json
from instagrapi import Client
from instagrapi.exceptions import ChallengeRequired, LoginRequired

# Configura aquí los datos
USUARIO = "kraveaibot"
CONTRASENA = "Andrick99#"
ARCHIVO_SESION = f"ig_session_{USUARIO}.json"
PROXY_FILE = "src/proxies/proxies.txt"

def obtener_proxy():
    if not os.path.exists(PROXY_FILE):
        return None
    with open(PROXY_FILE, "r") as f:
        proxies = [line.strip() for line in f if line.strip()]
    return proxies[0] if proxies else None

def login_y_guardar_sesion(usuario, password):
    cl = Client()
    proxy = obtener_proxy()
    if proxy:
        cl.set_proxy(proxy)

    try:
        cl.login(usuario, password)
        with open(ARCHIVO_SESION, "w") as f:
            f.write(cl.get_settings_json())
        print(f"✅ Sesión iniciada y guardada correctamente para {usuario}")
    except ChallengeRequired:
        print("❌ Instagram pide verificación (ChallengeRequired)")
    except LoginRequired:
        print("❌ Se requiere login (LoginRequired)")
    except Exception as e:
        print(f"❌ Error general: {e}")

if __name__ == "__main__":
    login_y_guardar_sesion(USUARIO, CONTRASENA)
