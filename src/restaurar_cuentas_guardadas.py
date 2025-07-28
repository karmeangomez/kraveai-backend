import json, os
from src.login_utils import restaurar_sesion, verificar_sesion, guardar_sesion

RUTA_CUENTAS = "cuentas_creadas.json"

if not os.path.exists(RUTA_CUENTAS):
    print("⚠️ No hay cuentas guardadas.")
    exit(0)

with open(RUTA_CUENTAS, "r") as f:
    cuentas = json.load(f)

for cuenta in cuentas:
    username = cuenta.get("username")
    password = cuenta.get("password")
    if not username or not password:
        continue
    print(f"🔄 Restaurando cuenta: {username}")
    cl = restaurar_sesion(username, password)
    if cl and verificar_sesion(cl, username):
        guardar_sesion(cl, username)
        print(f"✅ Sesión activa y guardada: {username}")
    else:
        print(f"❌ No se pudo restaurar: {username}")

