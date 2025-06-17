# instagram_utils.py – Versión mejorada con MarkdownV2 en Telegram
import subprocess
import json
import os
import logging
import time
from datetime import datetime
from telegram_utils import notify_telegram

# Configuración de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("instagram_utils.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("InstagramUtils")

CUENTAS_PATH = "cuentas_creadas.json"
MAX_RETRIES = 3
RETRY_DELAY = 5

def guardar_cuenta(data: dict):
    try:
        if not os.path.exists(CUENTAS_PATH):
            with open(CUENTAS_PATH, "w", encoding="utf-8") as f:
                json.dump([], f)

        cuentas = []
        if os.path.exists(CUENTAS_PATH):
            with open(CUENTAS_PATH, "r", encoding="utf-8") as f:
                try:
                    cuentas = json.load(f)
                except json.JSONDecodeError:
                    logger.warning("Archivo de cuentas corrupto, iniciando nuevo")
                    cuentas = []

        data["guardado_en"] = datetime.now().isoformat()
        data["intentos"] = data.get("intentos", 0) + 1
        cuentas.append(data)

        temp_path = f"{CUENTAS_PATH}.tmp"
        with open(temp_path, "w", encoding="utf-8") as f:
            json.dump(cuentas, f, indent=2, ensure_ascii=False)

        os.replace(temp_path, CUENTAS_PATH)
        return True
    except Exception as e:
        logger.error(f"Error crítico guardando cuenta: {str(e)}")
        return False

def crear_cuenta_instagram(client=None):
    attempt = 0
    result = None
    error_msg = ""

    while attempt < MAX_RETRIES:
        attempt += 1
        try:
            logger.info(f"Intento {attempt}/{MAX_RETRIES} creando cuenta")
            result = subprocess.run(
                ["node", "crearCuentaInstagram.js"],
                capture_output=True,
                text=True,
                encoding="utf-8",
                timeout=180,
                errors="replace"
            )

            if result.returncode == 0:
                try:
                    cuenta = json.loads(result.stdout.strip())
                    required_fields = ["usuario", "email", "proxy", "status"]
                    if not all(field in cuenta for field in required_fields):
                        missing = [f for f in required_fields if f not in cuenta]
                        raise ValueError(f"Campos faltantes: {', '.join(missing)}")

                    cuenta["creation_time"] = datetime.now().isoformat()
                    cuenta["intentos"] = attempt

                    if guardar_cuenta(cuenta):
                        mensaje = (
                            f"✅ *Cuenta creada*\n"
                            f"👤 \\@{cuenta['usuario']}\n"
                            f"📧 `{cuenta['email']}`\n"
                            f"🛡️ `{cuenta['proxy']}`\n"
                            f"🔄 Intentos: {attempt}"
                        )
                        notify_telegram(mensaje, parse_mode="MarkdownV2")
                    else:
                        logger.error("Fallo guardando cuenta a pesar de creación exitosa")

                    return cuenta

                except json.JSONDecodeError as je:
                    error_msg = f"Error JSON: {str(je)} | Salida: {result.stdout[:100]}..."
                    logger.error(error_msg)

                except ValueError as ve:
                    error_msg = f"Validación fallida: {str(ve)}"
                    logger.error(error_msg)

            else:
                error_msg = (
                    f"Script falló (código {result.returncode})\n"
                    f"Error: {result.stderr.strip() or 'Sin mensaje'}"
                )
                logger.error(error_msg)

        except subprocess.TimeoutExpired:
            error_msg = "Timeout: Proceso excedió 3 minutos"
            logger.error(error_msg)

        except Exception as e:
            error_msg = f"Excepción inesperada: {type(e).__name__} - {str(e)}"
            logger.exception(error_msg)

        if attempt < MAX_RETRIES:
            logger.info(f"Reintentando en {RETRY_DELAY} segundos...")
            time.sleep(RETRY_DELAY)

    final_error = (
        f"❌ *Fallo creando cuenta después de {MAX_RETRIES} intentos*\n"
        f"`{error_msg}`"
    )
    notify_telegram(final_error, parse_mode="MarkdownV2")
    return {
        "status": "error",
        "error": final_error,
        "attempts": MAX_RETRIES,
        "last_output": result.stdout[:300] + "..." if result else None
    }

