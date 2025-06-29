import fetch from 'node-fetch';

// Usar variables de entorno para seguridad
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export async function notifyTelegram(message) {
  // Verificar configuración completa
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn('⚠️ Configuración de Telegram incompleta');
    console.warn('   Asegúrate de configurar TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID');
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'KraveAI-Bot/1.0'
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      }),
      timeout: 15000
    });

    if (!response.ok) {
      let errorDetails = '';
      try {
        const errorData = await response.json();
        errorDetails = errorData.description || 'Sin detalles adicionales';
      } catch {
        errorDetails = 'No se pudo analizar la respuesta de error';
      }
      
      throw new Error(`HTTP error! status: ${response.status}, ${errorDetails}`);
    }

    console.log('📲 Notificación enviada a Telegram');
    return true;
  } catch (error) {
    console.error('❌ Error al enviar mensaje a Telegram:', error.message);
    
    // Detalles adicionales para diagnóstico
    if (error.message.includes('404')) {
      console.error('   Posibles causas:');
      console.error('   1. Token de bot incorrecto');
      console.error('   2. ID de chat inválido');
      console.error('   3. El bot no ha sido iniciado con @BotFather');
    }
    
    if (error.message.includes('getaddrinfo EAI_AGAIN')) {
      console.error('   Error de DNS: No se puede resolver api.telegram.org');
      console.error('   Verifica tu conexión a internet o configura DNS (8.8.8.8)');
    }
    
    return false;
  }
}
