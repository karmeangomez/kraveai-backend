// instagramLogin.js

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const UserAgent = require('user-agents');
const proxyChain = require('proxy-chain');
const chromium = require('@sparticuz/chromium');
const logger = require('./logger.js');
const fs = require('fs');
const path = require('path');
const { saveCookies, loadCookies } = require('./cookies.js');

puppeteer.use(StealthPlugin());

function getCookies() {
  const cookiePath = path.join(__dirname, 'sessions', 'kraveaibot.json');
  if (fs.existsSync(cookiePath)) {
    try {
      return JSON.parse(fs.readFileSync(cookiePath));
    } catch (err) {
      logger.warn('⚠️ Error leyendo cookies:', err.message);
    }
  }
  return [];
}

async function isSessionValid(page) {
  try {
    await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle2' });
    await page.waitForSelector('nav[role="navigation"]', { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

async function ensureLoggedIn() {
  const proxies = process.env.PROXY_LIST?.split(',') || [];
  const proxy = proxies[Math.floor(Math.random() * proxies.length)];
  const proxyUrl = await proxyChain.anonymizeProxy(proxy);

  const browser = await puppeteer.launch({
    args: [...chromium.args, `--proxy-server=${proxyUrl}`],
    executablePath: chromium.executablePath,
    headless: chromium.headless
  });

  const page = await browser.newPage();

  try {
    const cookies = getCookies();
    if (cookies.length > 0) await page.setCookie(...cookies);

    await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded' });
    const loggedIn = await page.evaluate(() =>
      !!document.querySelector('nav[role="navigation"]')
    );

    logger.info(`🔐 Sesión actual: ${loggedIn ? 'ACTIVA' : 'NO ACTIVA'}`);
    return loggedIn;
  } catch (err) {
    logger.error('❌ Error en ensureLoggedIn:', err.message);
    return false;
  } finally {
    await browser.close();
    await proxyChain.closeAnonymizedProxy(proxyUrl);
  }
}

async function smartLogin({ username, password, options = {} }) {
  const { maxRetries = 3, proxyList = [] } = options;
  let browser = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const userAgent = new UserAgent({ deviceCategory: 'desktop' }).toString();

      let proxyUrl = null;
      const proxy = proxyList[(attempt - 1) % proxyList.length];
      logger.info(`🔁 Proxy [${attempt}/${maxRetries}]: ${proxy}`);

      try {
        proxyUrl = await proxyChain.anonymizeProxy(proxy);
      } catch {
        logger.warn(`⚠️ Proxy inválido: ${proxy}`);
        continue;
      }

      browser = await puppeteer.launch({
        args: [...chromium.args, `--proxy-server=${proxyUrl}`],
        executablePath: chromium.executablePath,
        headless: chromium.headless,
        defaultViewport: null
      });

      const page = await browser.newPage();
      await page.setUserAgent(userAgent);

      const cookies = await loadCookies(page, username);
      if (cookies) {
        logger.info('🍪 Cookies cargadas');
        await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle2' });
        if (await isSessionValid(page)) {
          logger.info('✅ Sesión válida con cookies');
          return { success: true, browser, page };
        }
      }

      logger.info('🔐 Login manual iniciado');
      await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle2' });
      await page.type('input[name="username"]', username, { delay: 100 });
      await page.type('input[name="password"]', password, { delay: 120 });

      await Promise.all([
        page.click('button[type="submit"]'),
        page.waitForNavigation({ waitUntil: 'networkidle2' }),
      ]);

      if (await isSessionValid(page)) {
        await saveCookies(page, username);
        logger.info(`✅ Login exitoso para ${username}`);
        return { success: true, browser, page };
      } else {
        throw new Error('Login fallido');
      }

    } catch (err) {
      logger.error(`❌ Error en intento ${attempt}: ${err.message}`);
      if (browser) await browser.close().catch(() => {});
      if (proxyUrl) await proxyChain.closeAnonymizedProxy(proxyUrl).catch(() => {});
    }
  }

  const error = new Error('❌ Login fallido tras múltiples intentos');
  logger.error(error.message);
  throw error;
}

module.exports = {
  smartLogin,
  ensureLoggedIn,
  getCookies
};
