const fs = require('fs').promises;
const path = require('path');
const proxyChain = require('proxy-chain');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const UserAgent = require('user-agents');
const { loadCookies, saveCookies, validateCookies } = require('./cookies');

puppeteer.use(StealthPlugin());

const COOKIE_PATH = path.join(__dirname, 'sessions', 'kraveaibot.json');

// Banco de proxies desde .env
function getProxyListFromEnv() {
  const raw = process.env.PROXY_LIST || '';
  return raw.split(';').map(p => p.trim()).filter(Boolean);
}

let proxyIndex = 0;
function getNextProxy() {
  const proxies = getProxyListFromEnv();
  if (!proxies.length) return null;
  const proxy = proxies[proxyIndex % proxies.length];
  proxyIndex++;
  return proxy;
}

async function smartLogin(username, password, sessionPath) {
  const rawProxy = getNextProxy();
  let proxyUrl = null;

  if (rawProxy) {
    try {
      proxyUrl = await proxyChain.anonymizeProxy(`http://${rawProxy}`);
      console.log('✅ Proxy válido:', proxyUrl);
    } catch (err) {
      console.warn('⚠️ Proxy inválido:', rawProxy);
    }
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-zygote',
      '--window-size=1280,800',
      ...(proxyUrl ? [`--proxy-server=${proxyUrl}`] : [])
    ],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome',
    ignoreHTTPSErrors: true
  });

  const page = await browser.newPage();

  try {
    await page.setUserAgent(new UserAgent().toString());
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
    await page.setRequestInterception(true);
    page.on('request', req => {
      const type = req.resourceType();
      if (['image', 'media', 'font', 'stylesheet'].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.goto('https://www.instagram.com/accounts/login/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    await page.waitForSelector('input[name="username"]', { timeout: 10000 });
    await page.type('input[name="username"]', username, { delay: 50 });
    await page.type('input[name="password"]', password, { delay: 50 });

    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 });

    const url = page.url();
    if (url.includes('/challenge') || url.includes('/error')) {
      throw new Error('Instagram bloqueó el login (challenge/IP detectada)');
    }

    const cookies = await page.cookies();
    await saveCookies(cookies, sessionPath);

    console.log('🔐 Login exitoso y cookies guardadas');
    return { success: true, browser };
  } catch (err) {
    console.error('❌ Error en smartLogin:', err.message);
    await browser.close();
    return { success: false };
  }
}

async function ensureLoggedIn() {
  const username = process.env.IG_USERNAME;
  const password = process.env.INSTAGRAM_PASS;
  const sessionPath = COOKIE_PATH;

  if (!username || !password) {
    throw new Error('Faltan IG_USERNAME o INSTAGRAM_PASS en .env');
  }

  const cookies = await loadCookies(sessionPath);
  if (validateCookies(cookies)) {
    console.log('[Cookies] Sesión válida encontrada');
    return { browser: null };
  }

  const result = await smartLogin(username, password, sessionPath);
  if (!result.success) {
    throw new Error('Login fallido');
  }

  return { browser: result.browser };
}

function getCookies() {
  try {
    const cookies = require(COOKIE_PATH);
    return cookies;
  } catch {
    return [];
  }
}

function notifyTelegram(message) {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!chatId || !token) return;

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const body = {
    chat_id: chatId,
    text: message
  };

  require('axios').post(url, body).catch(() => {});
}

module.exports = {
  ensureLoggedIn,
  getCookies,
  notifyTelegram
};
