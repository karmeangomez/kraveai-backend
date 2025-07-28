import os
from dotenv import load_dotenv
from src.login_utils import login_instagram, guardar_sesion

load_dotenv()
username = os.getenv("INSTA_USER")
password = os.getenv("INSTA_PASS")

print(f"🔐 Iniciando sesión para: {username}...")

cl = login_instagram(username, password)

if cl:
    print(f"✅ Sesión iniciada correctamente para {username}")
    guardar_sesion(cl, username)
else:
    print(f"❌ No se pudo iniciar sesión para {username}")
