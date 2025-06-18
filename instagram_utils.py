import subprocess
import json
import os
import logging
import requests
import random
from datetime import datetime

logger = logging.getLogger("InstagramUtils")

CUENTAS_PATH = "cuentas_creadas.json"

def guardar_cuenta(data: dict) -> bool:
    """Guarda cuenta eficientemente en Raspberry Pi"""
    try:
        # Modo append para bajo consumo
        data["timestamp"] = datetime.now().isoformat()
        with open(CUENTAS_PATH, "a", encoding="utf-8") as f:
            f.write(json.dumps(data) + "\n")
        return True
    except Exception as e:
        logger.error(f"Error guardando cuenta: {str(e)}")
        return False

def crear_cuenta_instagram():
    """Crea cuenta con rotación de proxies y verificación"""
    try:
        # 1. Rotación de proxies
        with open("proxies.json", "r") as f:
            proxies = json.load(f)
        proxy = random.choice(proxies)
        
        # 2. Flags para bajo consumo
        flags = [
            '--single-process',
            '--no-zygote',
            '--no-sandbox',
            '--disable-dev-shm-usage'
        ]
        
        # 3. Ejecutar creación
        result = subprocess.run(
            ["node", "crearCuentaInstagram.js", proxy] + flags,
            capture_output=True,
            text=True,
            timeout=240,  # 4 minutos
            encoding="utf-8"
        )
        
        if result.returncode == 0:
            cuenta = json.loads(result.stdout.strip())
            cuenta["proxy"] = proxy
            
            # 4. Verificación solo si es necesario
            if cuenta.get("requires_verification") and not cuenta.get("verification_code"):
                try:
                    response = requests.get(
                        "http://localhost:8000/get-verification-code",
                        timeout=15
                    )
                    if response.status_code == 200:
                        verification = response.json()
                        if verification.get("code"):
                            cuenta["verification_code"] = verification["code"]
                except:
                    pass
            
            guardar_cuenta(cuenta)
            return cuenta
        else:
            return {"error": result.stderr[:200]}
            
    except subprocess.TimeoutExpired:
        return {"error": "Tiempo excedido"}
    except Exception as e:
        return {"error": str(e)}
