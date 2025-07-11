// ~/kraveai-backend/src/telegram_utils.js
import fetch from 'node-fetch';
require('dotenv').config();

const API_URL = process.env.API_URL || 'http://localhost:8000';

export async function notifyTelegram(message) {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
    console.warn('⚠️ Configuración de Telegram incompleta');
    console.warn('   Asegúrate de configurar TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID');
    return false;
  }

  try {
    const url = `${API_URL}/api/notify-telegram`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
      timeout: 15000
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('📲 Notificación enviada a Telegram');
    return data.success;
  } catch (error) {
    console.error('❌ Error al enviar mensaje a Telegram:', error.message);
    if (error.message.includes('404')) {
      console.error('   Posibles causas: URL de API incorrecta o endpoint no encontrado');
    }
    if (error.message.includes('getaddrinfo EAI_AGAIN')) {
      console.error('   Error de DNS: Verifica tu conexión a internet o la URL de la API');
    }
    return false;
  }
}
