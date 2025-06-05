const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { instagramLogin } = require('./instagramLogin');
const { Telegraf } = require('telegraf');

puppeteer.use(StealthPlugin());

const app = express();
const port = process.env.PORT || 3000;

// Middlewares base
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));

// Telegram para notificaciones
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// ================== 🔁 Notificaciones =====================
async function sendTelegramNotification(message) {
  try {
    if (!process.env.TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
    await bot.telegram.sendMessage(TELEGRAM_CHAT_ID, message);
    console.log('📩 Telegram:', message);
  } catch (error) {
    console.warn('⚠️ No se pudo enviar mensaje Telegram:', error.message);
  }
}

// ================== 🔐 Verificar variables =====================
const required = ['INSTAGRAM_USER', 'INSTAGRAM_PASS', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'];
const missing = required.filter(v => !process.env[v]);
if (missing.length > 0) {
  console.error('❌ Faltan variables:', missing.join(', '));
  sendTelegramNotification('❌ Faltan variables de entorno: ' + missing.join(', '));
}

// ================== 🔑 Iniciar sesión automática =====================
async function initializeBotSession() {
  const username = process.env.INSTAGRAM_USER;
  const password = process.env.INSTAGRAM_PASS;

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    console.log(`🔐 Iniciando sesión como ${username}...`);
    const ok = await instagramLogin(page, username, password, 'kraveaibot');

    if (ok) {
      global.browser = browser;
      global.mainPage = page;
      const cookies = await page.cookies();
      const sessionPath = path.join(__dirname, 'accounts/sessions/kraveaibot.json');
      await fs.mkdir(path.dirname(sessionPath), { recursive: true });
      await fs.writeFile(sessionPath, JSON.stringify(cookies, null, 2));
      console.log('✅ Sesión kraveaibot activa');
      sendTelegramNotification(`✅ Sesión iniciada correctamente: ${username}`);
    } else {
      throw new Error('Desafío o fallo de login');
    }
  } catch (err) {
    console.error('❌ Error de login:', err.message);
    sendTelegramNotification('⚠️ Fallo al iniciar sesión kraveaibot: ' + err.message);
    if (browser) await browser.close();
  }
}

// ================== 🔌 Rutas externas =====================
app.use('/api', require('./routes/createAccounts'));
app.use('/api', require('./routes/addClient'));
app.use('/api', require('./routes/getAccounts'));

try {
  require.resolve('./routes/chat') && app.use('/api', require('./routes/chat'));
  require.resolve('./routes/bitly') && app.use('/', require('./routes/bitly'));
  require.resolve('./routes/voice') && app.use('/', require('./routes/voice'));
} catch (_) {
  console.warn('⚠️ Rutas opcionales no encontradas');
}

// ================== 🚀 Iniciar =====================
initializeBotSession().finally(() => {
  app.listen(port, () => {
    console.log(`✅ Servidor activo en puerto ${port}`);
    sendTelegramNotification(`🚀 Servidor iniciado en puerto ${port}`);
  });
});
