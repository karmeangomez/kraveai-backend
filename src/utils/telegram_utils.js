import fetch from 'node-fetch';

const TELEGRAM_BOT_TOKEN = 'TU_BOT_TOKEN';
const TELEGRAM_CHAT_ID = 'TU_CHAT_ID';

export async function notifyTelegram(message) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn('⚠️ Configuración de Telegram incompleta');
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML'
      }),
      timeout: 10000
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`HTTP error! status: ${response.status}, ${errorData.description || ''}`);
    }

    console.log('📲 Notificación enviada a Telegram');
    return true;
  } catch (error) {
    console.error('❌ Error al enviar mensaje:', error.message);
    return false;
  }
}
