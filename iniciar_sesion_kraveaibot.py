import os
from dotenv import load_dotenv
from src.login_utils import login_instagram, guardar_sesion, verificar_sesion

load_dotenv()

# Leer credenciales desde .env
username = os.getenv("INSTA_USER")
password = os.getenv("INSTA_PASS")

if not username or not password:
    print("❌ No se encontraron credenciales en el archivo .env")
    exit(1)

print(f"🔐 Iniciando sesión para: {username}...")

cl = login_instagram(username, password)

if cl and verificar_sesion(cl, username):
    guardar_sesion(cl, username)
    print(f"✅ Sesión iniciada y guardada correctamente para {username}")
else:
    print(f"❌ No se pudo iniciar sesión para {username}")
