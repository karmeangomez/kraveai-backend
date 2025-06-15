# email_verifier.py - Sistema híbrido con InstAddr + fallback inteligente

import re
import time
import requests
import logging
import json
import os
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("EmailVerifier")

# =================== CONFIG ===================
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9"
}

# =================== UTILS ===================
def extraer_codigo(texto):
    match = re.search(r"\b(\d{6})\b", texto)
    return match.group(1) if match else None

# =================== INSTADDR ===================
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

# =================== MAILDROP ===================
def leer_codigo_maildrop(alias, max_intentos=5):
    for _ in range(max_intentos):
        try:
            r = requests.get(f"https://maildrop.cc/api/mailbox/{alias}", headers=HEADERS)
            if r.status_code == 200:
                mensajes = r.json().get("messages", [])
                for msg in mensajes:
                    if "Instagram" in msg.get("subject", ""):
                        match = re.search(r"(\d{6})", msg.get("body", ""))
                        if match:
                            return match.group(1)
        except Exception as e:
            logger.warning(f"[MailDrop] Error: {e}")
        time.sleep(3)
    return None

# =================== 10MINUTEMAIL ===================
def crear_email_10min():
    try:
        r = requests.post("https://10minutemail.com/session/address", headers=HEADERS, timeout=10)
        if r.status_code == 200:
            return r.json().get("address")
    except Exception as e:
        logger.warning(f"[10MinuteMail] Error creando email: {e}")
    return None

def leer_codigo_10min(max_intentos=6):
    for _ in range(max_intentos):
        try:
            r = requests.get("https://10minutemail.com/messages", headers=HEADERS)
            if r.status_code == 200:
                mensajes = r.json().get("messages", [])
                for msg in mensajes:
                    if "Instagram" in msg.get("subject", ""):
                        match = re.search(r"(\d{6})", msg.get("body", ""))
                        if match:
                            return match.group(1)
        except Exception as e:
            logger.warning(f"[10MinuteMail] Error: {e}")
        time.sleep(3)
    return None

# =================== SISTEMA PRINCIPAL ===================
def obtener_codigo_verificacion(timeout=90):
    logger.info("🔁 Iniciando sistema de verificacion híbrido")

    # 1. InstAddr
    correo = crear_email_instaddr()
    if correo:
        logger.info(f"📬 InstAddr creado: {correo}")
        code = leer_codigo_instaddr(correo)
        if code:
            logger.info(f"✅ Código InstAddr: {code}")
            return code, correo
        else:
            logger.warning("❌ InstAddr falló, probando fallback")

    # 2. MailDrop fallback
    alias = "verificador"  # puede cambiarse
    code = leer_codigo_maildrop(alias)
    if code:
        return code, f"{alias}@maildrop.cc"

    # 3. 10MinuteMail fallback
    correo = crear_email_10min()
    if correo:
        code = leer_codigo_10min()
        if code:
            return code, correo

    logger.error("❌ No se pudo obtener el código desde ningún servicio")
    return None, None

# =================== PRUEBA ===================
if __name__ == "__main__":
    code, correo = obtener_codigo_verificacion()
    if code:
        print(f"\n✅ Código obtenido: {code} para {correo}")
    else:
        print("\n❌ No se pudo obtener el código")
