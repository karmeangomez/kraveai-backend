# ~/kraveai-backend/src/telegram_utils.py
import os
import requests
import time
from requests.exceptions import RequestException

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")

def notify_telegram(message):
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        print("⚠️ Configuración de Telegram incompleta")
        print("   Asegúrate de configurar TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID")
        return False

    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": message,
        "parse_mode": "HTML",
        "disable_web_page_preview": True
    }
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "KraveAI-Bot/1.0"
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=15)
        if not response.ok:
            error_details = response.json().get("description", "Sin detalles adicionales") if response.text else "No se pudo analizar la respuesta de error"
            raise RequestException(f"HTTP error! status: {response.status}, {error_details}")

        print("📲 Notificación enviada a Telegram")
        return True

    except RequestException as error:
        print("❌ Error al enviar mensaje a Telegram:", error)
        if "404" in str(error):
            print("   Posibles causas: Token de bot incorrecto, ID de chat inválido, o bot no iniciado con @BotFather")
        elif "getaddrinfo" in str(error):
            print("   Error de DNS: Verifica tu conexión a internet o configura DNS (8.8.8.8)")
        return False
