const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const proxyChain = require('proxy-chain');
const fs = require('fs').promises;
const path = require('path');
const UserAgent = require('user-agents');
const { Telegraf } = require('telegraf');
const { loadCookies, saveCookies, validateCookies } = require('./cookies');

puppeteer.use(StealthPlugin());

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const telegramBot = TELEGRAM_BOT_TOKEN ? new Telegraf(TELEGRAM_BOT_TOKEN) : null;
const COOKIE_PATH = path.join(__dirname, 'instagram_cookies.json');
let proxyIndex = 0;

function getNextProxy() {
  const list = process.env.PROXY_LIST;
  if (!list) return null;
  const proxies = list.split(';').map(p => p.trim()).filter(Boolean);
  if (!proxies.length) return null;
  const proxy = proxies[proxyIndex % proxies.length];
  proxyIndex++;
  return proxy;
}

async function notifyTelegram(message) {
  if (!telegramBot || !TELEGRAM_CHAT_ID) return;
  try {
    await telegramBot.telegram.sendMessage(TELEGRAM_CHAT_ID, message);
    console.log(`[Telegram] ${message}`);
  } catch (err) {
    console.warn('❌ Telegram error:', err.message);
  }
}

async function launchBrowserWithProxy(proxyUrl) {
  const anonymizedProxy = await proxyChain.anonymizeProxy(`http://${proxyUrl}`);
  const args = [
    `--proxy-server=${anonymizedProxy}`,
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-blink-features=AutomationControlled',
    '--single-process',
    '--window-size=1280,800'
  ];
  return puppeteer.launch({
    headless: true,
    args,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
    ignoreHTTPSErrors: true
  });
}

async function instagramLogin(page, username, password) {
  if (!page) throw new Error('Página de Puppeteer no inicializada');

  const userAgent = new UserAgent().toString();
  await page.setUserAgent(userAgent);
  await page.setRequestInterception(true);
  page.on('request', req => {
    const block = ['image', 'media', 'stylesheet', 'font'];
    block.includes(req.resourceType()) ? req.abort() : req.continue();
  });

  await page.goto('https://www.instagram.com/accounts/login/', {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });

  const usernameInput = await page.waitForSelector('input[name="username"]', { timeout: 10000 });
  await usernameInput.type(username, { delay: 80 });

  const passwordInput = await page.waitForSelector('input[name="password"]', { timeout: 10000 });
  await passwordInput.type(password, { delay: 80 });

  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {})
  ]);

  const url = page.url();
  if (url.includes('/challenge') || url.includes('two_factor')) {
    throw new Error('Challenge o 2FA detectado');
  }

  const cookies = await page.cookies();
  await saveCookies(cookies);
  return true;
}

async function ensureLoggedIn() {
  const username = process.env.IG_USERNAME;
  const password = process.env.INSTAGRAM_PASS;
  if (!username || !password) throw new Error('❌ IG_USERNAME o INSTAGRAM_PASS no están definidos');

  const cookies = await loadCookies();
  if (validateCookies(cookies)) {
    console.log('✅ Cookies válidas cargadas');
    return true;
  } else {
    console.log('🟠 No hay cookies válidas. Iniciando login...');
  }

  for (let attempt = 1; attempt <= 5; attempt++) {
    const proxyUrl = getNextProxy();
    if (!proxyUrl) throw new Error('No hay proxies disponibles en PROXY_LIST');

    let browser;
    let page;

    try {
      console.log(`🔁 Intento de login #${attempt} con proxy ${proxyUrl}`);
      browser = await launchBrowserWithProxy(proxyUrl);

      if (!browser || !browser.isConnected()) throw new Error('El navegador no se inició correctamente');

      try {
        page = await browser.newPage();
      } catch (err) {
        throw new Error(`No se pudo abrir la página: ${err.message}`);
      }

      const success = await instagramLogin(page, username, password);
      await browser.close();
      if (success) {
        await notifyTelegram('✅ Sesión de Instagram iniciada correctamente');
        return true;
      }
    } catch (error) {
      console.warn(`❌ Error en intento ${attempt}: ${error.message}`);
      await notifyTelegram(`❌ Error en login IG: ${error.message}`);
      if (browser) await browser.close().catch(() => {});
    }
  }

  throw new Error('❌ Todos los intentos de login fallaron');
}

module.exports = {
  ensureLoggedIn,
  notifyTelegram
};
