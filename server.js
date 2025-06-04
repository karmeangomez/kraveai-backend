const express = require('express');
const cors = require('cors');
const path = require('path');
const { createMultipleAccounts } = require('./instagramAccountCreator');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { instagramLogin } = require('./instagramLogin');
const { Telegraf } = require('telegraf');
const fs = require('fs').promises;

puppeteer.use(StealthPlugin());

// Configurar Telegram para notificaciones
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Función para enviar notificaciones a Telegram
async function sendTelegramNotification(message) {
  try {
    if (!process.env.TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      console.warn('⚠️ TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID no definidos, notificaciones desactivadas');
      return;
    }
    await bot.telegram.sendMessage(TELEGRAM_CHAT_ID, message);
    console.log('📩 Notificación enviada a Telegram:', message);
  } catch (error) {
    console.error('❌ Error enviando notificación a Telegram:', error.message);
  }
}

// Función para cargar cuentas existentes y evitar mezclar kraveaibot
async function loadAccounts() {
  const accountsFile = path.join(__dirname, 'accounts', 'accounts.json');
  try {
    await fs.mkdir(path.join(__dirname, 'accounts'), { recursive: true });
    if (await fs.access(accountsFile).then(() => true).catch(() => false)) {
      return JSON.parse(await fs.readFile(accountsFile, 'utf8'));
    }
    return { accounts: [] };
  } catch (error) {
    console.error('❌ Error loading accounts:', error.message);
    return { accounts: [] };
  }
}

// Función para guardar cuentas creadas (excluyendo kraveaibot)
async function saveAccounts(accounts) {
  const accountsFile = path.join(__dirname, 'accounts', 'accounts.json');
  try {
    await fs.writeFile(accountsFile, JSON.stringify(accounts, null, 2));
    console.log('✅ Accounts saved successfully');
  } catch (error) {
    console.error('❌ Error saving accounts:', error.message);
  }
}

// Función para iniciar sesión con reintentos y manejo de desafíos
async function initializeBotSession(maxRetries = 3, delayBetweenRetries = 30000) {
  const username = process.env.INSTAGRAM_USER;
  const password = process.env.INSTAGRAM_PASS;

  if (!username || !password) {
    const errorMsg = '❌ Variables de entorno INSTAGRAM_USER o INSTAGRAM_PASS no definidas';
    await sendTelegramNotification(errorMsg);
    throw new Error(errorMsg);
  }

  let browser;
  try {
    browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔐 Intento ${attempt}/${maxRetries} de iniciar sesión como kraveaibot (${username})...`);
        const loginSuccess = await instagramLogin(page, username, password, 'kraveaibot');
        if (loginSuccess) {
          console.log('✅ Sesión de kraveaibot iniciada correctamente');
          await sendTelegramNotification('✅ Sesión de kraveaibot iniciada correctamente');
          global.browser = browser; // Guardar navegador para uso en funciones
          global.mainPage = page; // Guardar página principal para reutilizar

          // Guardar sesión de kraveaibot en un archivo separado
          const cookies = await page.cookies();
          const sessionPath = path.join(__dirname, 'accounts', 'sessions', 'kraveaibot.json');
          await fs.mkdir(path.dirname(sessionPath), { recursive: true });
          await fs.writeFile(sessionPath, JSON.stringify(cookies, null, 2));
          console.log('✅ Sesión de kraveaibot guardada en:', sessionPath);

          return true;
        } else {
          console.warn(`⚠️ Fallo al iniciar sesión de kraveaibot (intento ${attempt}/${maxRetries}), posible desafío de seguridad`);
          const pageContent = await page.content();
          if (pageContent.includes('captcha') || pageContent.includes('phone')) {
            const challengeMsg = `⚠️ Desafío de seguridad detectado para kraveaibot (${username}). Resuelve manualmente: ${page.url()}`;
            await sendTelegramNotification(challengeMsg);
            console.log('⏳ Esperando resolución manual...');
            await new Promise(resolve => setTimeout(resolve, 120000)); // Espera 2 minutos
          }
          if (attempt === maxRetries) {
            const errorMsg = '❌ Fallo final al iniciar sesión de kraveaibot después de todos los intentos';
            await sendTelegramNotification(errorMsg);
            throw new Error(errorMsg);
          }
        }
      } catch (error) {
        console.error(`❌ Error en intento ${attempt}/${maxRetries}:`, error.message);
        if (attempt === maxRetries) {
          const errorMsg = `❌ Fallo final al iniciar sesión de kraveaibot: ${error.message}`;
          await sendTelegramNotification(errorMsg);
          throw new Error(errorMsg);
        }
        await new Promise(resolve => setTimeout(resolve, delayBetweenRetries));
      }
    }
  } catch (error) {
    if (browser) await browser.close();
    throw error;
  }
}

// Iniciar el servidor y la sesión
(async () => {
  try {
    await initializeBotSession();
  } catch (error) {
    console.error('⚠️ No se pudo iniciar sesión de kraveaibot, pero el servidor seguirá funcionando:', error.message);
    await sendTelegramNotification(`⚠️ No se pudo iniciar sesión de kraveaibot: ${error.message}`);
  }

  const app = express();
  const port = process.env.PORT || 3000;

  app.use(cors());
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '.')));

  // Endpoint para "Crear Cuentas"
  app.post('/create-accounts', async (req, res) => {
    try {
      const { count = 3 } = req.body;
      if (count < 1 || count > 10) {
        return res.status(400).json({ error: 'El número de cuentas debe estar entre 1 y 10' });
      }
      if (!global.browser || !global.mainPage) {
        throw new Error('❌ No hay sesión de navegador activa, resuelve el desafío o reinicia el servidor');
      }
      const page = await global.browser.newPage(); // Nueva página para esta acción
      const accounts = await createMultipleAccounts(count, page);
      await page.close(); // Cerrar la página después de usarla

      // Asegurarse de que kraveaibot no se mezcle con las cuentas creadas
      const existingAccounts = await loadAccounts();
      const kraveaibotUsername = process.env.INSTAGRAM_USER;
      existingAccounts.accounts = existingAccounts.accounts.filter(acc => acc.username !== kraveaibotUsername);
      existingAccounts.accounts.push(...accounts);
      await saveAccounts(existingAccounts);

      res.json({ success: true, accounts });
    } catch (err) {
      res.status(500).json({ error: 'Error creando cuentas', details: err.message });
    }
  });

  // Endpoint para "Añadir Clientes" (placeholder)
  app.post('/add-client', async (req, res) => {
    try {
      const { username } = req.body;
      if (!username) {
        return res.status(400).json({ error: 'Se requiere un username para añadir un cliente' });
      }
      if (!global.browser || !global.mainPage) {
        throw new Error('❌ No hay sesión de navegador activa, resuelve el desafío o reinicia el servidor');
      }
      const page = await global.browser.newPage();
      console.log(`📋 Añadiendo cliente: ${username}`);
      await page.close();
      res.json({ success: true, message: `Cliente ${username} añadido` });
    } catch (err) {
      res.status(500).json({ error: 'Error añadiendo cliente', details: err.message });
    }
  });

  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
})();
