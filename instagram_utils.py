# instagram_utils.py

import subprocess
import json
import os

CUENTAS_PATH = "cuentas_creadas.json"

def guardar_cuenta(data):
    if not os.path.exists(CUENTAS_PATH):
        with open(CUENTAS_PATH, "w") as f:
            json.dump([], f)
    with open(CUENTAS_PATH, "r") as f:
        cuentas = json.load(f)
    cuentas.append(data)
    with open(CUENTAS_PATH, "w") as f:
        json.dump(cuentas, f, indent=2)

def crear_cuenta_instagram(client=None):
    try:
        result = subprocess.run(["node", "crearCuentaInstagram.js"], capture_output=True, text=True)
        print("📤 Output JS:", result.stdout)

        # Simulación de cuenta creada (ajusta si tu JS retorna JSON real)
        output_data = {
            "usuario": "kraveai_user_01",
            "email": "kraveai_user_01@mail.com",
            "proxy": "123.456.789.0:8080",
            "status": "active"
        }

        if result.returncode == 0:
            guardar_cuenta(output_data)
            return output_data
        else:
            return {"status": "error", "error": result.stderr}
    except Exception as e:
        return {"status": "error", "error": str(e)}
