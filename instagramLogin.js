// instagramLogin.js actualizado - login + cookies + proxies + validación robusta

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const UserAgent = require('user-agents');
const proxyChain = require('proxy-chain');
const chromium = require('@sparticuz/chromium');
const logger = require('./logger');
const fs = require('fs');
const path = require('path');
const { saveCookies, loadCookies } = require('./cookies');

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
  const proxies = (process.env.PROXY_LIST || '').split(',').filter(p => p.trim());
  let proxyUrl = null;
  let browser = null;

  try {
    if (proxies.length > 0) {
      const proxy = proxies[Math.floor(Math.random() * proxies.length)];
      proxyUrl = await proxyChain.anonymizeProxy(proxy);
    }

    const executablePath = await chromium.executablePath();
    const launchOptions = {
      headless: chromium.headless,
      executablePath,
      args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox']
    };
    if (proxyUrl) launchOptions.args.push(`--proxy-server=${proxyUrl}`);

    browser = await puppeteer.launch(launchOptions);
    const [page] = await browser.pages();

    const cookies = getCookies();
    if (cookies.length > 0) {
      await page.setCookie(...cookies);
      logger.info('🍪 Cookies cargadas');
    }

    await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    const loggedIn = await isSessionValid(page);
    logger.info(`🔐 Sesion actual: ${loggedIn ? 'ACTIVA' : 'NO ACTIVA'}`);
    return loggedIn;

  } catch (err) {
    logger.error('❌ Error en ensureLoggedIn:', err.message);
    return false;
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (proxyUrl) await proxyChain.closeAnonymizedProxy(proxyUrl).catch(() => {});
  }
}

async function smartLogin({ username, password, options = {} }) {
  const { maxRetries = 3, proxyList = [] } = options;
  let browser = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let proxyUrl = null;
    try {
      const userAgent = new UserAgent({ deviceCategory: 'desktop' }).toString();
      const proxy = proxyList[(attempt - 1) % proxyList.length] || '';
      logger.info(`🔁 Intento [${attempt}/${maxRetries}] con proxy: ${proxy}`);

      if (proxy) proxyUrl = await proxyChain.anonymizeProxy(proxy);

      browser = await puppeteer.launch({
        headless: chromium.headless,
        executablePath: await chromium.executablePath(),
        args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox', ...(proxyUrl ? [`--proxy-server=${proxyUrl}`] : [])],
        defaultViewport: null,
        timeout: 30000,
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
      await page.type('input[name="username"]', username, { delay: Math.random() * 100 + 50 });
      await page.type('input[name="password"]', password, { delay: Math.random() * 100 + 50 });

      await Promise.all([
        page.click('button[type="submit"]'),
        page.waitForNavigation({ waitUntil: 'networkidle2' })
      ]);

      const errorMessage = await page.$('div[role="alert"]');
      if (errorMessage) {
        const text = await page.evaluate(el => el.textContent, errorMessage);
        throw new Error(`Error de login: ${text}`);
      }

      if (await isSessionValid(page)) {
        await saveCookies(page, username);
        logger.info(`✅ Login exitoso para ${username}`);
        return { success: true, browser, page };
      } else {
        throw new Error('Login fallido: sesión no válida');
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
