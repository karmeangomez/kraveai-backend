import subprocess
import json
import random
import logging
from datetime import datetime

logger = logging.getLogger("InstagramUtils")

def crear_cuenta_instagram():
    """Crea cuenta con rotación de proxies y bajo consumo"""
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
            return cuenta
        else:
            return {"error": result.stderr[:200]}
            
    except subprocess.TimeoutExpired:
        return {"error": "Tiempo excedido"}
    except Exception as e:
        return {"error": str(e)}
