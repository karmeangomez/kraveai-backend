import json
import time
from src.login_utils import login_instagram, guardar_sesion, guardar_cuenta_api

def reintentar_login(username, password):
    print(f"🔄 Intentando iniciar sesión para: {username}")
    try:
        cl = login_instagram(username, password)
        if cl:
            print(f"✅ Sesión iniciada correctamente: {username}")
            guardar_sesion(cl, username)
            guardar_cuenta_api(username, password)
            return True
    except Exception as e:
        print(f"⚠️ Error: {str(e)}")
    return False

def cargar_cuentas():
    try:
        with open("cuentas_creadas.json", "r") as f:
            return json.load(f)
    except:
        return []

def seleccionar_cuenta():
    cuentas = cargar_cuentas()
    if not cuentas:
        print("❌ No hay cuentas guardadas.")
        return None, None

    print("📋 Cuentas disponibles:")
    for i, cuenta in enumerate(cuentas):
        print(f"{i + 1}. {cuenta['username']}")

    try:
        index = int(input("Selecciona una cuenta (número): ")) - 1
        cuenta = cuentas[index]
        return cuenta["username"], cuenta["password"]
    except:
        print("❌ Selección inválida.")
        return None, None

if __name__ == "__main__":
    print("👨‍💻 Reintentar login manual (aprobación desde la app si es necesario)")
    username, password = seleccionar_cuenta()

    if username and password:
        print(f"🔐 Usuario: {username}")
        print("⏳ Espera a que se genere el intento de login...")

        ok = reintentar_login(username, password)

        if ok:
            print("✅ Login exitoso y sesión guardada.")
        else:
            print("❌ No se pudo iniciar sesión. Intenta más tarde.")
