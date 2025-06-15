# email_verifier.py - Sistema híbrido con InstAddr + guardado por correo

import re
import time
import requests
import logging
import os
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("EmailVerifier")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9"
}

def extraer_codigo(texto):
    match = re.search(r"\b(\d{6})\b", texto)
    return match.group(1) if match else None

def crear_email_instaddr():
    try:
        r = requests.get("https://m.kuku.lu/api.gen.php?type=new", headers=HEADERS, timeout=10)
        if r.status_code == 200:
            data = r.json()
            return data['address'] if data.get('success') else None
    except Exception as e:
        logger.warning(f"[InstAddr] Error creando correo: {e}")
    return None

def leer_codigo_instaddr(correo, max_intentos=8):
    alias = correo.split("@")[0]
    for _ in range(max_intentos):
        try:
            data = {"type": "list", "account": alias}
            r = requests.post("https://m.kuku.lu/recv.php", headers=HEADERS, data=data, timeout=10)
            if r.status_code == 200 and "Instagram" in r.text:
                match = re.search(r"(\d{6})", r.text)
                if match:
                    return match.group(1)
        except Exception as e:
            logger.warning(f"[InstAddr] Error leyendo bandeja: {e}")
        time.sleep(3)
    return None

def obtener_codigo_verificacion(timeout=90):
    logger.info("🔁 Iniciando sistema de verificación híbrido")
    correo = crear_email_instaddr()
    if correo:
        logger.info(f"📬 InstAddr creado: {correo}")
        code = leer_codigo_instaddr(correo)
        if code:
            logger.info(f"✅ Código InstAddr: {code}")
            return code, correo
        else:
            logger.warning("❌ InstAddr falló en recibir código")
    logger.error("❌ No se pudo obtener el código desde ningún servicio")
    return None, None

# =================== EJECUCIÓN DIRECTA ===================
if __name__ == "__main__":
    code, correo = obtener_codigo_verificacion()
    if code:
        print(f"\n✅ Código obtenido: {code} para {correo}")
        try:
            safe_email = correo.replace("@", "_at_").replace(".", "_")
            path_dir = os.path.join(os.getcwd(), "codigos")
            os.makedirs(path_dir, exist_ok=True)
            full_path = os.path.join(path_dir, f"{safe_email}.txt")
            with open(full_path, "w") as f:
                f.write(code.strip())
            logger.info(f"💾 Código guardado en {full_path}")
        except Exception as e:
            logger.error(f"❌ No se pudo guardar el código por correo: {e}")
    else:
        print("\n❌ No se pudo obtener el código")
