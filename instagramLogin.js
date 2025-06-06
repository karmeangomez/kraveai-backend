// ✅ instagramLogin.js final optimizado con proxy dinámico y memoria controlada
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const chromium = require('@sparticuz/chromium');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const UserAgent = require('user-agents');
const { Telegraf } = require('telegraf');
const { getNextProxy } = require('./proxyBank');
const cookies = require('./cookies');

puppeteer.use(StealthPlugin());

const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const telegramBot = TELEGRAM_BOT_TOKEN ? new Telegraf(TELEGRAM_BOT_TOKEN) : null;

async function notifyTelegram(message) {
  if (!telegramBot || !TELEGRAM_CHAT_ID) return;
  try {
    await telegramBot.telegram.sendMessage(TELEGRAM_CHAT_ID, message);
    console.log('📩 Notificación Telegram:', message);
  } catch (err) {
    console.error('❌ Error enviando Telegram:', err.message);
  }
}

function decryptPassword() {
  try {
    const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
    const iv = Buffer.from(process.env.ENCRYPTION_IV, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    return decipher.update(process.env.INSTAGRAM_PASS, 'base64', 'utf8') + decipher.final('utf8');
  } catch (err) {
    console.error('❌ Error al desencriptar contraseña:', err.message);
    return process.env.INSTAGRAM_PASS;
  }
}

async function smartLogin(page, username, password) {
  const userAgent = new UserAgent({ deviceCategory: 'desktop' }).toString();
  await page.setUserAgent(userAgent);
  await page.setJavaScriptEnabled(true);
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const block = ['image', 'stylesheet', 'font', 'media'];
    if (block.includes(req.resourceType())) req.abort();
    else req.continue();
  });

  console.log(`🧠 Usando User-Agent: ${userAgent}`);

  const response = await page.goto('https://www.instagram.com/accounts/login/', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
    referer: 'https://www.google.com/'
  });

  console.log(`🌐 HTTP Status: ${response.status()}`);

  if (response.status() === 429) {
    await notifyTelegram('❌ Instagram bloqueó la IP (HTTP 429)');
    throw new Error('IP bloqueada (429)');
  }

  try {
    await page.waitForSelector('input[name="username"]', { timeout: 15000 });
    await page.type('input[name="username"]', username, { delay: 50 });
    await page.type('input[name="password"]', password, { delay: 50 });
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 });

    const cookiesData = await page.cookies();
    await cookies.saveCookies(cookiesData);

    console.log('✅ Login exitoso');
    await notifyTelegram('✅ Sesión de Instagram iniciada correctamente');
    return true;
  } catch (err) {
    await notifyTelegram(`❌ Error durante login: ${err.message}`);
    throw err;
  }
}

async function ensureLoggedIn() {
  const username = process.env.IG_USERNAME;
  const password = decryptPassword();

  if (!username || !password) throw new Error('[Instagram] Credenciales no válidas');

  const cookiesLoaded = await cookies.loadCookies();
  if (cookies.validateCookies(cookiesLoaded)) {
    global.cookiesCache = cookiesLoaded;
    console.log('[Instagram] Usando cookies guardadas, no se requiere login.');
    return;
  }

  const proxy = await getNextProxy();
  console.log(`🌐 Usando proxy: ${proxy}`);

  const browser = await puppeteer.launch({
    args: [
      ...chromium.args,
      `--proxy-server=http://${proxy}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--single-process',
      '--no-zygote',
      '--js-flags=--max-old-space-size=256'
    ],
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
    ignoreHTTPSErrors: true
  });

  const page = await browser.newPage();
  if (proxy.includes('@')) {
    const [auth] = proxy.split('@');
    const [proxyUser, proxyPass] = auth.split(':');
    await page.authenticate({ username: proxyUser, password: proxyPass });
  }

  const result = await smartLogin(page, username, password);
  if (result) {
    global.browser = browser;
    global.page = page;
  } else {
    await browser.close();
    throw new Error('Login fallido');
  }
}

module.exports = {
  ensureLoggedIn,
  getCookies: () => global.cookiesCache || [],
  notifyTelegram
};
