import crearCuentaInstagram from './accounts/crearCuentaInstagram.js';
import proxySystem from './proxies/proxyRotationSystem.js';
import axios from 'axios';

async function sendTelegramNotification(message) {
  try {
    if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
      console.warn('⚠️ Advertencia: TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID no definidos en .env');
      return;
    }
    const response = await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: process.env.TELEGRAM_CHAT_ID,
      text: message
    });
    if (response.data.ok) {
      console.log('📲 Notificación enviada a Telegram via axios.');
    } else {
      console.error('❌ Error en Telegram API:', response.data.description);
    }
  } catch (error) {
    console.error('❌ Error al enviar mensaje:', error.response?.data || error.message);
  }
}

async function main() {
  console.log('[2025-06-27T11:36:00.000Z] 🔥 Iniciando KraveAI-Granja Rusa 🔥');
  console.log(`✅ Plataforma: ${process.platform}`);
  console.log(`✅ Modo: ${process.env.HEADLESS || 'false'}`);
  console.log(`✅ Cuentas a crear: 50`);

  await sendTelegramNotification('🔥 Iniciando KraveAI-Granja Rusa 🔥');
  console.log('🧹 Limpiando 0 cuentas...');

  try {
    await proxySystem.initialize();
    console.log('[2025-06-27T11:36:01.000Z] ✅ Sistema de proxies listo');
  } catch (error) {
    console.error('❌ Error inicializando proxies:', error.message);
    await new Promise(resolve => setTimeout(resolve, 60000)); // Retraso de 60s antes de reintentar
    await proxySystem.initialize();
    console.log('[2025-06-27T11:37:01.000Z] ✅ Sistema de proxies reiniciado');
  }

  for (let i = 1; i <= 50; i++) {
    console.log(`\n🚀 Creando cuenta ${i}/50`);
    try {
      const proxy = proxySystem.getNextProxy();
      const account = await crearCuentaInstagram(proxy);
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] ${account.status === 'created' ? '✅' : '❌'} ${account.status}: ${account.error || `@${account.username}`}`);

      if (account.status === 'created') {
        await sendTelegramNotification(`✅ Cuenta añadida: @${account.username}`);
      } else {
        await sendTelegramNotification(`❌ Fallo: ${account.error}`);
        await new Promise(resolve => setTimeout(resolve, 30000)); // Retraso de 30s tras fallo
      }
    } catch (error) {
      const timestamp = new Date().toISOString();
      console.error(`[${timestamp}] ❌ Error inesperado: ${error.message}`);
      await sendTelegramNotification(`❌ Error inesperado: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, 30000)); // Retraso de 30s tras error
    }
    if (i < 50) await new Promise(resolve => setTimeout(resolve, 10000)); // Retraso de 10s entre cuentas
  }
}

main().catch(error => {
  console.error('❌ Error fatal en main:', error.message);
  sendTelegramNotification(`❌ Error fatal: ${error.message}`).catch(console.error);
});
