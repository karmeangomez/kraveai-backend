# instagram_utils.py – Versión mejorada
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
MAX_RETRIES = 3  # Intentos antes de fallar definitivamente
RETRY_DELAY = 5  # Segundos entre reintentos

def guardar_cuenta(data: dict):
    """Guarda cada cuenta de forma atómica con manejo de concurrencia"""
    try:
        # Crear archivo si no existe
        if not os.path.exists(CUENTAS_PATH):
            with open(CUENTAS_PATH, "w", encoding="utf-8") as f:
                json.dump([], f)
        
        # Bloqueo para escritura segura
        cuentas = []
        if os.path.exists(CUENTAS_PATH):
            with open(CUENTAS_PATH, "r", encoding="utf-8") as f:
                try:
                    cuentas = json.load(f)
                except json.JSONDecodeError:
                    logger.warning("Archivo de cuentas corrupto, iniciando nuevo")
                    cuentas = []
        
        # Añadir metadatos de auditoría
        data["guardado_en"] = datetime.now().isoformat()
        data["intentos"] = data.get("intentos", 0) + 1
        cuentas.append(data)
        
        # Escritura atómica
        temp_path = f"{CUENTAS_PATH}.tmp"
        with open(temp_path, "w", encoding="utf-8") as f:
            json.dump(cuentas, f, indent=2, ensure_ascii=False)
        
        os.replace(temp_path, CUENTAS_PATH)
        
        return True
    except Exception as e:
        logger.error(f"Error crítico guardando cuenta: {str(e)}")
        return False

def crear_cuenta_instagram(client=None):
    """Crea cuenta con reintentos y validación mejorada"""
    attempt = 0
    result = None
    
    while attempt < MAX_RETRIES:
        attempt += 1
        try:
            logger.info(f"Intento {attempt}/{MAX_RETRIES} creando cuenta")
            
            # Ejecutar proceso con timeout extendido
            result = subprocess.run(
                ["node", "crearCuentaInstagram.js"],
                capture_output=True,
                text=True,
                encoding="utf-8",
                timeout=180,  # 3 minutos
                errors="replace"
            )
            
            # Validar resultado
            if result.returncode == 0:
                try:
                    cuenta = json.loads(result.stdout.strip())
                    
                    # Validación estructural crítica
                    required_fields = ["usuario", "email", "proxy", "status"]
                    if not all(field in cuenta for field in required_fields):
                        missing = [f for f in required_fields if f not in cuenta]
                        raise ValueError(f"Campos faltantes: {', '.join(missing)}")
                    
                    # Auditoría y notificación
                    cuenta["creation_time"] = datetime.now().isoformat()
                    cuenta["intentos"] = attempt
                    
                    if guardar_cuenta(cuenta):
                        notify_telegram(
                            f"✅ Cuenta creada: @{cuenta['usuario']}\n"
                            f"📧 Email: {cuenta['email']}\n"
                            f"🛡️ Proxy: {cuenta['proxy']}\n"
                            f"🔄 Intentos: {attempt}"
                        )
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
        
        # Esperar antes de reintentar
        if attempt < MAX_RETRIES:
            logger.info(f"Reintentando en {RETRY_DELAY} segundos...")
            time.sleep(RETRY_DELAY)
    
    # Notificar fallo definitivo
    final_error = (
        f"❌ Fallo creando cuenta después de {MAX_RETRIES} intentos\n"
        f"Último error: {error_msg}"
    )
    notify_telegram(final_error)
    return {
        "status": "error",
        "error": final_error,
        "attempts": MAX_RETRIES,
        "last_output": result.stdout[:300] + "..." if result else None
    }
