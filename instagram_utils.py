# instagram_utils.py — Ejecuta creación de cuentas con Puppeteer desde Python

import subprocess
import json

def crear_cuenta_instagram(client=None):
    try:
        result = subprocess.run(
            ["node", "crearCuentaInstagram.js"],
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            print("📤 Output JS:", result.stdout)
            try:
                cuenta = json.loads(result.stdout)
                return cuenta  # <-- debe contener usuario, email, proxy, status
            except Exception as e:
                return {"usuario": None, "email": None, "proxy": None, "status": "error", "error": "Output no es JSON"}
        else:
            return {"usuario": None, "email": None, "proxy": None, "status": "error", "error": result.stderr}
    except Exception as e:
        return {"usuario": None, "email": None, "proxy": None, "status": "error", "error": str(e)}
