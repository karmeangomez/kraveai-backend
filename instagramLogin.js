const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const chromium = require('@sparticuz/chromium');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const UserAgent = require('user-agents');
const { Telegraf } = require('telegraf');

puppeteer.use(StealthPlugin());

const COOKIE_PATH = path.join(__dirname, 'instagram_cookies.json');
let cookiesCache = [];

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

async function handleCookies() {
  try {
    const data = await fs.readFile(COOKIE_PATH, 'utf8');
    cookiesCache = JSON.parse(data);
    const sessionCookie = cookiesCache.find(c => c.name === 'sessionid');
    if (sessionCookie?.expires > Date.now() / 1000) {
      console.log('[Instagram] Sesión válida encontrada');
      return true;
    }
  } catch {
    console.warn('[Instagram] No se encontraron cookies válidas');
  }
  return false;
}

async function smartLogin(page, username, password) {
  const userAgent = new UserAgent({ deviceCategory: 'desktop' }).toString();
  await page.setUserAgent(userAgent);
  await page.setJavaScriptEnabled(true);
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

  console.log(`🧠 User-Agent usado: ${userAgent}`);

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

    cookiesCache = await page.cookies();
    await fs.writeFile(COOKIE_PATH, JSON.stringify(cookiesCache, null, 2));
    console.log('✅ Login exitoso');
    await notifyTelegram('✅ Sesión de Instagram iniciada correctamente');
    return true;
  } catch (err) {
    await notifyTelegram(`❌ Error durante login: ${err.message}`);
    throw err;
  }
}

async function ensureLoggedIn() {
  const username = process.env.IG_USERNAME || process.env.IG_USER;
  const password = decryptPassword();

  if (!username || !password) throw new Error('[Instagram] Credenciales no válidas');
  if (await handleCookies()) return;

  let browser;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true
    });

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
