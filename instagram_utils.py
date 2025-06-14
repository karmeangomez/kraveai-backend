# instagram_utils.py - Creador de cuentas reales con instagrapi y proxy

import os
import random
from instagrapi import Client
from nombre_utils import generar_nombre, generar_usuario

PROXY_LIST = os.getenv("PROXY_LIST", "").split(",")
IG_PASSWORD = os.getenv("INSTAGRAM_PASS", "KraveAi2025!")

def crear_cuenta_instagram():
    if not PROXY_LIST or PROXY_LIST[0] == "":
        raise ValueError("No hay proxies disponibles en PROXY_LIST")

    # Elegir un proxy aleatorio
    proxy = random.choice(PROXY_LIST).strip()
    nombre = generar_nombre()
    usuario = generar_usuario()
    email = f"{usuario}@tempmail.com"
    clave = IG_PASSWORD

    cl = Client()
    cl.set_proxy(proxy)

    try:
        # Esto normalmente requiere bypass de verificación por email/sms
        cl.signup(email=email, username=usuario, password=clave, first_name=nombre)
        return {
            "usuario": usuario,
            "email": email,
            "clave": clave,
            "proxy": proxy
        }
    except Exception as e:
        print(f"❌ Error creando cuenta: {e}")
        return None
