// utils/telegram.js
const axios = require('axios');

async function notifyTelegram(message) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.warn('⚠️ TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID no configurados en .env');
    return;
  }

  try {
    await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      chat_id: chatId,
      text: message
    });
    console.log('✅ Mensaje enviado a Telegram');
  } catch (err) {
    console.error('❌ Error enviando a Telegram:', err.response?.data || err.message);
  }
}

module.exports = { notifyTelegram };
