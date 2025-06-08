const fs = require('fs').promises;
const path = require('path');
const proxyChain = require('proxy-chain');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { loadCookies, saveCookies } = require('./cookies');
const { getNextProxy } = require('./proxyBank');
const UserAgent = require('user-agents');

puppeteer.use(StealthPlugin());

const COOKIE_PATH = path.join(__dirname, 'sessions', 'kraveaibot.json');

async function smartLogin(username, password, sessionPath) {
  const proxyUrlRaw = getNextProxy();
  let proxyUrl = null;

  if (proxyUrlRaw) {
    try {
      proxyUrl = await proxyChain.anonymizeProxy(`http://${proxyUrlRaw}`);
      console.log('✅ Proxy válido:', proxyUrl);
    } catch (err) {
      console.warn('⚠️ Proxy inválido:', proxyUrlRaw);
    }
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--single-process',
      '--no-zygote',
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
    await page.waitForTimeout(2000);

    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 });

    const url = page.url();
    if (url.includes('/challenge') || url.includes('/error')) {
      throw new Error('Instagram rechazó el login (posible challenge o IP bloqueada)');
    }

    const cookies = await page.cookies();
    await saveCookies(cookies, sessionPath);
    console.log('🔐 Login exitoso y cookies guardadas');
    return { success: true, browser, page };
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
  if (cookies && cookies.length > 0) {
    console.log('[Cookies] Sesión válida encontrada');
    return true;
  }

  const result = await smartLogin(username, password, sessionPath);
  if (!result.success) {
    throw new Error('Login fallido');
  }

  return true;
}

function getCookies() {
  try {
    const cookies = require(COOKIE_PATH);
    return cookies;
  } catch {
    return [];
  }
}

function notifyTelegram(msg) {
  console.log('[Telegram]', msg);
}

// ✅ Exportación correcta
module.exports = {
  instagramLogin: smartLogin,
  ensureLoggedIn,
  getCookies,
  notifyTelegram
};
