import crearCuentaInstagram from './accounts/crearCuentaInstagram.js';
import proxySystem from './proxies/proxyRotationSystem.js';
import axios from 'axios';

async function sendTelegramNotification(message) {
  try {
    await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: process.env.TELEGRAM_CHAT_ID,
      text: message
    });
    console.log('📲 Notificación enviada a Telegram.');
  } catch (error) {
    console.error('❌ Error al enviar mensaje:', error.response?.data || error.message);
  }
}

async function main() {
  console.log('[2025-06-26T23:35:00.000Z] 🔥 Iniciando KraveAI-Granja Rusa 🔥');
  console.log(`✅ Plataforma: ${process.platform}`);
  console.log(`✅ Modo: ${process.env.HEADLESS || 'false'}`);
  console.log(`✅ Cuentas a crear: 50`);

  await sendTelegramNotification('🔥 Iniciando KraveAI-Granja Rusa 🔥');
  console.log('🧹 Limpiando 0 cuentas...');

  await proxySystem.initialize();
  console.log('[2025-06-26T23:36:00.000Z] ✅ Sistema de proxies listo');

  for (let i = 1; i <= 50; i++) {
    console.log(`\n🚀 Creando cuenta ${i}/50`);
    const account = await crearCuentaInstagram(proxySystem.getNextProxy());
    console.log(`[${new Date().toISOString()}] ${account.status === 'created' ? '✅' : '❌'} ${account.status}: ${account.error || account.username}`);
    if (account.status === 'failed') {
      await sendTelegramNotification(`❌ Fallo: ${account.error}`);
      await new Promise(resolve => setTimeout(resolve, 15000));
    } else {
      await sendTelegramNotification(`✅ Cuenta añadida: @${account.username}`);
    }
  }
}

main().catch(console.error);
