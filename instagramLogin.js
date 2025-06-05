// instagramLogin.js
const { Telegraf } = require('telegraf');
const fs = require('fs').promises;

// Configura el bot de Telegram
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Variables globales para almacenar cookies
let cookies = [];

// Función para notificar a Telegram
async function notifyTelegram(message) {
  try {
    await bot.telegram.sendMessage(process.env.TELEGRAM_CHAT_ID, message);
    console.log('📢 Notificación enviada a Telegram:', message);
  } catch (err) {
    console.error('❌ Error enviando notificación a Telegram:', err.message);
  }
}

// Función para guardar cookies en un archivo
async function saveCookies(pageCookies) {
  try {
    cookies = pageCookies;
    await fs.writeFile('cookies.json', JSON.stringify(cookies, null, 2));
    console.log('🍪 Cookies guardadas en cookies.json');
  } catch (err) {
    console.error('❌ Error guardando cookies:', err.message);
    await notifyTelegram(`❌ Error guardando cookies: ${err.message}`);
  }
}

// Función para cargar cookies desde un archivo
async function loadCookies() {
  try {
    const data = await fs.readFile('cookies.json', 'utf8');
    cookies = JSON.parse(data);
    console.log('🍪 Cookies cargadas desde cookies.json');
  } catch (err) {
    console.warn('⚠️ No se pudieron cargar cookies:', err.message);
    cookies = [];
  }
}

// Función para obtener las cookies actuales
function getCookies() {
  return cookies;
}

// Función para realizar el login en Instagram
async function ensureLoggedIn(page) {
  try {
    // Carga cookies previas si existen
    await loadCookies();

    // Si ya hay cookies, intenta usarlas
    if (cookies.length > 0) {
      await page.setCookie(...cookies);
      await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 15000 });

      // Verifica si la sesión sigue activa
      const isLoggedIn = await page.evaluate(() => {
        return document.querySelector('a[href*="/accounts/activity/"]') !== null;
      });

      if (isLoggedIn) {
        console.log('✅ Sesión activa con cookies previas');
        await saveCookies(await page.cookies());
        return;
      } else {
        console.log('⚠️ Sesión expirada, intentando login...');
      }
    }

    // Si no hay cookies o la sesión expiró, realiza el login
    await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Espera a que el formulario de login esté visible
    const usernameInput = await page.waitForSelector('input[name="username"]', { visible: true, timeout: 10000 });
    if (!usernameInput) {
      throw new Error('No se encontró el campo de usuario');
    }

    const passwordInput = await page.waitForSelector('input[name="password"]', { visible: true, timeout: 10000 });
    if (!passwordInput) {
      throw new Error('No se encontró el campo de contraseña');
    }

    // Rellena los campos y envía el formulario
    await usernameInput.type(process.env.INSTAGRAM_USERNAME, { delay: 100 });
    await passwordInput.type(process.env.INSTAGRAM_PASSWORD, { delay: 100 });
    await page.click('button[type="submit"]');

    // Espera a que la navegación termine
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });

    // Verifica si el login fue exitoso
    const isLoggedIn = await page.evaluate(() => {
      return document.querySelector('a[href*="/accounts/activity/"]') !== null;
    });

    if (!isLoggedIn) {
      // Toma una captura para depuración
      await page.screenshot({ path: 'login-failed.png', fullPage: true });
      throw new Error('Login fallido: no se encontró el indicador de sesión activa');
    }

    // Guarda las cookies después del login
    await saveCookies(await page.cookies());
    console.log('✅ Login exitoso');
    await notifyTelegram('✅ Login en Instagram exitoso');
  } catch (err) {
    console.error('❌ Error en el login:', err.message);
    await notifyTelegram(`❌ Error en el login de Instagram: ${err.message}`);
    throw err; // Propaga el error para reiniciar si es necesario
  }
}

module.exports = { ensureLoggedIn, getCookies, notifyTelegram };