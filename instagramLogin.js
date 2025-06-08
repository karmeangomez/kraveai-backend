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
  let browser, page;

  const timeout = parseInt(process.env.PUPPETEER_TIMEOUT) || 60000;

  if (proxyUrlRaw) {
    try {
      proxyUrl = await proxyChain.anonymizeProxy(`http://${proxyUrlRaw}`);
      console.log('✅ Proxy válido:', proxyUrl);
    } catch (err) {
      console.warn('⚠️ Proxy inválido:', proxyUrlRaw);
    }
  }

  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-zygote',
        '--disable-extensions',
        '--window-size=1280,800',
        ...(proxyUrl ? [`--proxy-server=${proxyUrl}`] : [])
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome',
      ignoreHTTPSErrors: true
    });

    page = await browser.newPage();
    await page.setUserAgent(new UserAgent({ deviceCategory: 'desktop' }).toString());
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
      timeout
    });

    await page.waitForSelector('input[name="username"]', { timeout: timeout / 4 });
    await page.type('input[name="username"]', username, { delay: 50 });
    await page.type('input[name="password"]', password, { delay: 50 });

    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout });

    const url = page.url();
    if (url.includes('/challenge') || url.includes('/error')) {
      throw new Error('Instagram rechazó el login (challenge o IP bloqueada)');
    }

    const cookies = await page.cookies();
    await saveCookies(cookies, sessionPath);
    console.log('🔐 Login exitoso y cookies guardadas');
    return { success: true, browser, page };
  } catch (err) {
    console.error('❌ Error en smartLogin:', err.message);
    if (page && !page.isClosed()) await page.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    if (proxyUrl) await proxyChain.closeAnonymizedProxy(proxyUrl, true).catch(() => {});
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
    let browser, page;
    try {
      browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
      page = await browser.newPage();
      await page.setCookie(...cookies);
      await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 15000 });
      const loggedIn = await page.evaluate(() => !!document.querySelector('a[href*="/accounts/activity/"]'));
      await page.close();
      await browser.close();
      if (loggedIn) {
        console.log('[Cookies] Sesión válida encontrada');
        return true;
      }
    } catch (err) {
      console.warn('⚠️ Error validando cookies:', err.message);
      if (page && !page.isClosed()) await page.close().catch(() => {});
      if (browser) await browser.close().catch(() => {});
    }
  }

  for (let attempt = 1; attempt <= 3; attempt++) {
    const result = await smartLogin(username, password, sessionPath);
    if (result.success) return true;
    console.warn(`⚠️ Intento de login #${attempt} fallido`);
    await new Promise(resolve => setTimeout(resolve, attempt * 2000));
  }

  throw new Error('Login fallido después de múltiples intentos');
}

async function getCookies() {
  try {
    const raw = await fs.readFile(COOKIE_PATH, 'utf8');
    const cookies = JSON.parse(raw);
    return Array.isArray(cookies) ? cookies : [];
  } catch {
    return [];
  }
}

function notifyTelegram(msg) {
  console.log('[Telegram]', msg);
}

module.exports = {
  instagramLogin: smartLogin,
  ensureLoggedIn,
  getCookies,
  notifyTelegram
};
