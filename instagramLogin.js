// ✅ instagramLogin.js con proxy-chain, rotación inteligente y protección contra errores de proxy
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const chromium = require('@sparticuz/chromium');
const proxyChain = require('proxy-chain');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const UserAgent = require('user-agents');
const { Telegraf } = require('telegraf');
const { getNextProxy, reportFailure, reportSuccess } = require('./proxyBank');
const cookies = require('./cookies');

puppeteer.use(StealthPlugin());

const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const telegramBot = TELEGRAM_BOT_TOKEN ? new Telegraf(TELEGRAM_BOT_TOKEN) : null;

async function notifyTelegram(message) {
  if (!telegramBot || !TELEGRAM_CHAT_ID) return;
  try {
    await telegramBot.telegram.sendMessage(TELEGRAM_CHAT_ID, message);
    console.log('📩 Telegram:', message);
  } catch (err) {
    console.error('❌ Telegram error:', err.message);
  }
}

function decryptPassword() {
  try {
    const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
    const iv = Buffer.from(process.env.ENCRYPTION_IV, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    return decipher.update(process.env.INSTAGRAM_PASS, 'base64', 'utf8') + decipher.final('utf8');
  } catch (err) {
    console.error('❌ Desencriptación fallida:', err.message);
    return process.env.INSTAGRAM_PASS;
  }
}

async function smartLogin(page, username, password) {
  const userAgent = new UserAgent({ deviceCategory: 'desktop' }).toString();
  await page.setUserAgent(userAgent);
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
  await page.setJavaScriptEnabled(true);
  await page.setRequestInterception(true);
  page.on('request', req => {
    const block = ['image', 'stylesheet', 'font', 'media'];
    block.includes(req.resourceType()) ? req.abort() : req.continue();
  });

  const response = await page.goto('https://www.instagram.com/accounts/login/', {
    waitUntil: 'domcontentloaded', timeout: 30000
  });

  if (!response) throw new Error('No se recibió respuesta de Instagram');
  if (response.status() === 429) throw new Error('HTTP_429_IP_BLOCKED');

  const html = await page.content();
  if (html.includes('ERR_NO_SUPPORTED_PROXIES')) {
    throw new Error('ERR_NO_SUPPORTED_PROXIES');
  }

  await page.waitForSelector('input[name="username"]', { timeout: 10000 });
  await page.type('input[name="username"]', username, { delay: 50 });
  await page.type('input[name="password"]', password, { delay: 50 });
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });

  const cookiesData = await page.cookies();
  await cookies.saveCookies(cookiesData);
  console.log('✅ Login exitoso');
  return true;
}

async function ensureLoggedIn() {
  const username = process.env.IG_USERNAME;
  const password = decryptPassword();
  if (!username || !password) throw new Error('Credenciales inválidas');

  const prev = await cookies.loadCookies();
  if (cookies.validateCookies(prev)) {
    global.cookiesCache = prev;
    console.log('✅ Sesión activa con cookies');
    return;
  }

  let attempt = 0;
  const maxAttempts = 5;
  let proxy;

  while (attempt < maxAttempts) {
    proxy = getNextProxy();
    if (!proxy) throw new Error('Sin proxies disponibles');

    let anonymizedProxy;
    try {
      anonymizedProxy = await proxyChain.anonymizeProxy(`http://${proxy}`);
      console.log(`🌐 Usando proxy: ${proxy}`);
    } catch (err) {
      console.warn(`❌ Proxy inválido: ${proxy}`);
      reportFailure(proxy);
      attempt++;
      continue;
    }

    let browser;
    try {
      browser = await puppeteer.launch({
        args: [
          ...chromium.args,
          `--proxy-server=${anonymizedProxy}`,
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--single-process',
          '--no-zygote',
          '--js-flags=--max-old-space-size=256'
        ],
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
        ignoreHTTPSErrors: true,
        defaultViewport: chromium.defaultViewport
      });

      const page = await browser.newPage();
      const success = await smartLogin(page, username, password);

      if (success) {
        global.browser = browser;
        global.page = page;
        reportSuccess(proxy);
        return true;
      }
    } catch (error) {
      console.error(`❌ Error con proxy ${proxy}:`, error.message);
      reportFailure(proxy);
      notifyTelegram(`❌ Proxy fallido: ${proxy} → ${error.message}`);
      if (browser) await browser.close();
      attempt++;
      continue;
    }
  }

  throw new Error('Todos los proxies fallaron');
}

module.exports = {
  ensureLoggedIn,
  getCookies: () => global.cookiesCache || [],
  notifyTelegram
};
