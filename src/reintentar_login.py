# src/reintentar_login.py
import time
import json
import os
import sys

# Permitir ejecución directa desde src/
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.login_utils import login_instagram, guardar_sesion, verificar_sesion

CUENTAS_JSON = os.path.join(os.path.dirname(__file__), "../cuentas_creadas.json")

def guardar_en_json(username, password):
    cuentas = []
    if os.path.exists(CUENTAS_JSON):
        with open(CUENTAS_JSON, "r") as f:
            cuentas = json.load(f)

    if not any(c["username"] == username for c in cuentas):
        cuentas.append({"username": password})
        with open(CUENTAS_JSON, "w") as f:
            json.dump(cuentas, f, indent=2)
        print(f"✅ Cuenta guardada en {CUENTAS_JSON}")
    else:
        print("ℹ️ La cuenta ya estaba registrada")

def intentar_login(username, password):
    print(f"\n🔐 Intentando login para @{username}...\n")
    cl = login_instagram(username, password)

    if cl:
        if verificar_sesion(cl, username):
            guardar_sesion(cl, username)
            guardar_en_json(username, password)
            print(f"\n✅ Login exitoso y sesión verificada para @{username}\n")
        else:
            print(f"\n⚠️ Login completado pero sesión inválida para @{username}.")
    else:
        print(f"\n❌ Login fallido para @{username}. Revisa la app o el correo si hay un challenge.")

if __name__ == "__main__":
    print("📥 Login asistido para cuentas manuales de tareas")
    username = input("👤 Usuario de Instagram: ").strip()
    password = input("🔑 Contraseña: ").strip()

    intentar_login(username, password)
