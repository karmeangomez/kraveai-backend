const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const proxyChain = require('proxy-chain');
const fs = require('fs').promises;
const path = require('path');
const UserAgent = require('user-agents');
const { Telegraf } = require('telegraf');
const { loadCookies, saveCookies, validateCookies } = require('./cookies');

puppeteer.use(StealthPlugin());

const COOKIE_PATH = path.join(__dirname, 'instagram_cookies.json');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const telegramBot = TELEGRAM_BOT_TOKEN ? new Telegraf(TELEGRAM_BOT_TOKEN) : null;

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
    console.warn('❌ Error al enviar notificación Telegram:', err.message);
  }
}

async function launchBrowserWithProxy(proxyUrl) {
  const proxy = await proxyChain.anonymizeProxy(`http://${proxyUrl}`);
  const args = [
    `--proxy-server=${proxy}`,
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-blink-features=AutomationControlled',
    '--single-process',
    '--window-size=1280,800'
  ];
  return puppeteer.launch({
    headless: 'new',
    args,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome',
    ignoreHTTPSErrors: true
  });
}

async function instagramLogin(page, username, password) {
  if (!page) throw new Error('Página de Puppeteer no inicializada');
  const userAgent = new UserAgent();
  await page.setUserAgent(userAgent.toString());
  await page.setRequestInterception(true);
  page.on('request', req => {
    const block = ['image', 'media', 'stylesheet', 'font'];
    block.includes(req.resourceType()) ? req.abort() : req.continue();
  });

  await page.goto('https://www.instagram.com/accounts/login/', {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });

  const usernameInput = await page.waitForSelector('input[name="username"]', { timeout: 15000 });
  await usernameInput.type(username, { delay: 75 });

  const passwordInput = await page.waitForSelector('input[name="password"]', { timeout: 15000 });
  await passwordInput.type(password, { delay: 75 });

  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {})
  ]);

  const url = page.url();
  if (url.includes('/challenge') || url.includes('two_factor')) {
    throw new Error('Challenge o verificación de dos pasos detectado');
  }

  const cookies = await page.cookies();
  await saveCookies(cookies);
  return true;
}

async function ensureLoggedIn() {
  const username = process.env.IG_USERNAME;
  const password = process.env.INSTAGRAM_PASS;
  if (!username || !password) throw new Error('[Instagram] Credenciales no configuradas en variables de entorno');

  const cookies = await loadCookies();
  if (validateCookies(cookies)) {
    console.log('[Instagram] Sesión activa desde cookies');
    return true;
  } else {
    console.log('[Instagram] No se encontraron cookies válidas');
  }

  for (let attempt = 1; attempt <= 5; attempt++) {
    const proxyUrl = getNextProxy();
    if (!proxyUrl) throw new Error('[Proxy] No hay proxies disponibles');

    console.log(`🔁 Intento de login #${attempt} con proxy: ${proxyUrl}`);
    let browser = null;

    try {
      browser = await launchBrowserWithProxy(proxyUrl);
      const page = await browser.newPage();
      if (!page) throw new Error('No se pudo abrir una nueva página');
      const success = await instagramLogin(page, username, password);
      await browser.close();
      if (success) {
        console.log('✅ Login exitoso');
        await notifyTelegram('✅ Sesión de kraveaibot iniciada correctamente');
        return true;
      }
    } catch (err) {
      console.warn(`⚠️ Proxy inválido: ${proxyUrl}`);
      await notifyTelegram(`❌ Error de login: ${err.message}`);
      if (browser) await browser.close();
    }
  }

  throw new Error('[Instagram] Todos los intentos de login fallaron');
}

module.exports = {
  ensureLoggedIn,
  instagramLogin,
  notifyTelegram
};
