// monitorTelegram.js
require('dotenv').config();
const axios = require('axios');

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function sendTelegramMessage(text) {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
    console.warn('⚠️ TELEGRAM_BOT_TOKEN o CHAT_ID no definidos en .env');
    return;
  }

  try {
    await axios.post(TELEGRAM_API, {
      chat_id: CHAT_ID,
      text,
      parse_mode: 'Markdown'
    });
    console.log('📬 Notificación enviada por Telegram');
  } catch (err) {
    console.warn(`⚠️ Error enviando a Telegram: ${err.message}`);
  }
}

module.exports = { sendTelegramMessage };
