const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const proxyChain = require('proxy-chain');
const UserAgent = require('user-agents');

puppeteer.use(StealthPlugin());

const COOKIE_PATH = path.join(__dirname, 'cookies.json');
let cookiesCache = [];

// 📤 Notificación a Telegram
async function notifyTelegram(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  try {
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text: message,
    });
  } catch (err) {
    console.error('❌ Error enviando mensaje a Telegram:', err.message);
  }
}

// 💾 Guardar cookies
async function saveCookies(cookies) {
  cookiesCache = cookies;
  await fs.writeFile(COOKIE_PATH, JSON.stringify(cookies, null, 2));
  console.log('[Cookies] Guardadas correctamente');
}

// 📥 Cargar cookies
async function loadCookies(page) {
  try {
    const data = await fs.readFile(COOKIE_PATH, 'utf8');
    cookiesCache = JSON.parse(data);
    const valid = validateCookies(cookiesCache);
    if (valid) {
      await page.setCookie(...cookiesCache);
      console.log('[Cookies] Cargadas al navegador');
      return true;
    }
  } catch {
    console.log('[Cookies] No se encontraron cookies válidas');
  }
  return false;
}

// 📤 Obtener cookies para reutilizar
function getCookies() {
  return cookiesCache;
}

// ✅ Validar cookies existentes
function validateCookies(cookies) {
  if (!Array.isArray(cookies) || cookies.length === 0) return false;
  const sessionCookie = cookies.find((c) => c.name === 'sessionid');
  return sessionCookie && sessionCookie.expires * 1000 > Date.now();
}

// 🔁 Obtener proxy aleatorio del .env
async function getProxy() {
  const list = process.env.PROXY_LIST?.split(';').map(p => p.trim()).filter(Boolean);
  if (!list || list.length === 0) return null;

  const raw = list[Math.floor(Math.random() * list.length)];
  try {
    const clean = await proxyChain.anonymizeProxy(`http://${raw}`);
    console.log(`🔁 Proxy aplicado: ${clean}`);
    return clean;
  } catch (err) {
    console.warn(`⚠️ Proxy inválido: ${raw}`);
    return null;
  }
}

// 🔐 Login a Instagram
async function instagramLogin() {
  const IG_USERNAME = process.env.IG_USERNAME;
  const IG_PASSWORD = process.env.INSTAGRAM_PASS;

  if (!IG_USERNAME || !IG_PASSWORD) {
    throw new Error('Credenciales de Instagram no definidas');
  }

  const proxyUrl = await getProxy();

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      ...(proxyUrl ? [`--proxy-server=${proxyUrl}`] : [])
    ],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
    ignoreHTTPSErrors: true,
  });

  const page = await browser.newPage();
  await page.setUserAgent(new UserAgent().toString());
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

  try {
    // Intenta cargar cookies previas
    const cookiesOk = await loadCookies(page);
    await page.goto('https://www.instagram.com/', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    const alreadyLoggedIn = await page.evaluate(() => {
      return document.querySelector('nav')?.innerText?.includes('Inicio') ?? false;
    });

    if (cookiesOk && alreadyLoggedIn) {
      console.log('✅ Sesión de Instagram ya activa (cookies)');
      return { browser };
    }

    // Si no hay cookies válidas, hacer login manual
    await page.goto('https://www.instagram.com/accounts/login/', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    await page.waitForSelector('input[name="username"]', { timeout: 20000 });
    await page.type('input[name="username"]', IG_USERNAME, { delay: 75 });
    await page.type('input[name="password"]', IG_PASSWORD, { delay: 75 });
    await page.click('button[type="submit"]');

    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });

    const isLoginSuccessful = await page.evaluate(() => {
      return document.body.innerText.includes('Inicio') || window.location.href === 'https://www.instagram.com/';
    });

    if (!isLoginSuccessful) {
      throw new Error('Falló el login');
    }

    const newCookies = await page.cookies();
    await saveCookies(newCookies);
    console.log('✅ Login exitoso, cookies guardadas');

    return { browser };

  } catch (err) {
    await browser.close();
    console.error('❌ Error de login:', err.message);
    await notifyTelegram('❌ Error de login: ' + err.message);
    throw err;
  }
}

module.exports = {
  instagramLogin,
  notifyTelegram,
  getCookies
};
