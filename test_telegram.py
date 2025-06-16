# telegram_utils.py - Envío de notificaciones a Telegram

import os
import httpx
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")

def notify_telegram(mensaje: str):
    if not BOT_TOKEN or not CHAT_ID:
        print("❌ TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID no están configurados")
        return

    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    data = {
        "chat_id": CHAT_ID,
        "text": mensaje,
        "parse_mode": "Markdown"
    }

    try:
        response = httpx.post(url, data=data, timeout=10)
        if response.status_code != 200:
            print(f"⚠️ Telegram error: {response.status_code} {response.text}")
        else:
            print("📬 Notificación enviada a Telegram")
    except Exception as e:
        print(f"❌ Error al enviar mensaje a Telegram:", e)
