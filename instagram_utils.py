# instagram_utils.py — Ejecuta creación de cuentas con Puppeteer desde Python

import subprocess

def crear_cuenta_instagram(client=None):
    try:
        result = subprocess.run(["node", "crearCuentaInstagram.js"], capture_output=True, text=True)
        print("📤 Output JS:", result.stdout)
        if result.returncode == 0:
            return {"exito": True, "output": result.stdout}
        else:
            return {"exito": False, "error": result.stderr}
    except Exception as e:
        return {"exito": False, "error": str(e)}
