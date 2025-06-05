// ✅ instagramLogin.js optimizado para evitar SIGTERM (memoria, cierre seguro)
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const UserAgent = require('user-agents');
const { Telegraf } = require('telegraf');

const COOKIE_PATH = path.join(__dirname, 'instagram_cookies.json');
let cookiesCache = [];

const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const telegramBot = TELEGRAM_BOT_TOKEN ? new Telegraf(TELEGRAM_BOT_TOKEN) : null;

async function notifyTelegram(message) {
  if (!telegramBot || !TELEGRAM_CHAT_ID) return;
  try {
    await telegramBot.telegram.sendMessage(TELEGRAM_CHAT_ID, message);
    console.log('📩 Notificación enviada a Telegram:', message);
  } catch (err) {
    console.error('❌ Error al enviar notificación Telegram:', err.message);
  }
}

const CONFIG = {
  loginUrl: 'https://www.instagram.com/accounts/login/',
  browserOptions: {
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-accelerated-2d-canvas',
      '--disable-dev-tools',
      '--no-zygote',
      '--single-process',
      '--js-flags=--max-old-space-size=256',
      '--window-size=1280,800'
    ],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome',
    ignoreHTTPSErrors: true
  }
};

function decryptPassword() {
  try {
    const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
    const iv = Buffer.from(process.env.ENCRYPTION_IV, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    return decipher.update(process.env.INSTAGRAM_PASS, 'base64', 'utf8') + decipher.final('utf8');
  } catch (error) {
    console.error('[Instagram] Error de desencriptación:', error.message);
    return process.env.INSTAGRAM_PASS;
  }
}

async function handleCookies() {
  try {
    const data = await fs.readFile(COOKIE_PATH, 'utf8');
    cookiesCache = JSON.parse(data);
    const sessionCookie = cookiesCache.find(c => c.name === 'sessionid');
    if (sessionCookie?.expires > Date.now() / 1000) {
      console.log('[Instagram] Sesión válida encontrada');
      return true;
    }
  } catch (_) {
    console.warn('[Instagram] No se encontraron cookies válidas');
  }
  return false;
}

async function smartLogin(page, username, password) {
  const userAgent = new UserAgent({ deviceCategory: 'desktop' }).toString();
  console.log("🧪 Usando User-Agent:", userAgent);
  await page.setUserAgent(userAgent);
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
  await page.setViewport({ width: 1280, height: 800 });

  const response = await page.goto(CONFIG.loginUrl, { waitUntil: 'networkidle0' });
  console.log("🌐 Código de estado HTTP:", response.status());

  const selectors = [
    'input[name="username"]',
    'input[name="emailOrPhone"]',
    'input[aria-label*="Phone number"]',
    'input[type="text"]',
    'input[placeholder*="username"]',
    'input[autocomplete="username"]'
  ];

  let foundSelector = false;
  for (const selector of selectors) {
    try {
      await page.waitForSelector(selector, { timeout: 60000 });
      await page.click(selector);
      for (const char of username) {
        await page.keyboard.press(char);
        await page.waitForTimeout(Math.random() * 100 + 50);
      }
      foundSelector = true;
      break;
    } catch (_) {
      console.warn(`⚠️ Selector no encontrado: ${selector}`);
    }
  }

  if (!foundSelector) {
    const html = await page.content();
    console.log("📄 HTML de la página:", html.slice(0, 1000));
    await notifyTelegram('❌ No se encontró ningún campo de username. Revisa si Instagram cambió la página de login.');
    throw new Error('No se encontró ningún campo de username.');
  }

  await page.click('input[name="password"]');
  for (const char of password) {
    await page.keyboard.press(char);
    await page.waitForTimeout(Math.random() * 100 + 50);
  }

  await page.waitForTimeout(300);
  await page.evaluate(() => window.scrollBy(0, Math.floor(Math.random() * 100)));

  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60000 })
  ]);

  const url = page.url();
  if (url.includes('challenge') || url.includes('captcha')) {
    await notifyTelegram('⚠️ Instagram lanzó un desafío o captcha en el login de kraveaibot.');
    return false;
  }

  cookiesCache = await page.cookies();
  await fs.writeFile(COOKIE_PATH, JSON.stringify(cookiesCache, null, 2));
  console.log('[Instagram] Login exitoso con comportamiento humano');
  await notifyTelegram('✅ Sesión de kraveaibot iniciada correctamente');
  return true;
}

async function ensureLoggedIn() {
  const username = process.env.IG_USERNAME || process.env.IG_USER;
  const password = process.env.ENCRYPTION_KEY ? decryptPassword() : process.env.INSTAGRAM_PASS;

  console.log("🧪 Username:", username || 'NO DEFINIDO');
  console.log("🧪 Chrome path:", process.env.PUPPETEER_EXECUTABLE_PATH);

  if (!username) throw new Error('[Instagram] IG_USERNAME no está definido');
  if (!password) throw new Error('[Instagram] INSTAGRAM_PASS no pudo desencriptarse');

  if (await handleCookies()) return;

  let browser;
  try {
    browser = await puppeteer.launch(CONFIG.browserOptions);
    const page = await browser.newPage();
    const success = await smartLogin(page, username, password);
    if (!success) throw new Error('Login fallido');
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = {
  ensureLoggedIn,
  getCookies: () => cookiesCache,
  notifyTelegram
};
