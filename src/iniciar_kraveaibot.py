# src/iniciar_kraveaibot.py

import os
from dotenv import load_dotenv
from src.login_utils import login_instagram, guardar_sesion, guardar_cuenta_api

load_dotenv()

username = os.getenv("INSTA_USER")
password = os.getenv("INSTA_PASS")

print(f"🔐 Iniciando sesión como: {username}")

try:
    cl = login_instagram(username, password)
    if cl:
        guardar_sesion(cl, username)
        guardar_cuenta_api(username, password)
        print("✅ Sesión iniciada y guardada exitosamente.")
    else:
        print("❌ No se pudo iniciar sesión.")
except Exception as e:
    print(f"⚠️ Error: {str(e)}")
