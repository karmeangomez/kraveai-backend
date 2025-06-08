const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const UserAgent = require('user-agents');
const proxyChain = require('proxy-chain');
const chromium = require('@sparticuz/chromium');
const logger = require('./logger.js');
const fs = require('fs');
const { saveCookies, loadCookies } = require('./cookies.js');

puppeteer.use(StealthPlugin());

async function isSessionValid(page) {
  try {
    await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle2' });
    await page.waitForSelector('nav[role="navigation"]', { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

async function smartLogin({ username, password, options = {} }) {
  const { maxRetries = 3, proxyList = [] } = options;
  let browser = null;
  let page = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const userAgent = new UserAgent({ deviceCategory: 'desktop' }).toString();

      let proxyUrl = null;
      if (proxyList.length > 0) {
        const proxy = proxyList[(attempt - 1) % proxyList.length];
        logger.info(`🔁 Usando proxy [${attempt}/${maxRetries}]: ${proxy}`);
        try {
          proxyUrl = await proxyChain.anonymizeProxy(proxy);
        } catch (error) {
          logger.warn(`⚠️ Proxy inválido: ${proxy}`);
          continue;
        }
      }

      const launchOptions = {
        args: [
          ...chromium.args,
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          proxyUrl ? `--proxy-server=${proxyUrl}` : '',
        ].filter(Boolean),
        executablePath: chromium.executablePath,
        headless: chromium.headless,
        defaultViewport: null,
        timeout: parseInt(process.env.PUPPETEER_TIMEOUT) || 30000,
      };

      logger.debug(`🚀 Launching browser with options: ${JSON.stringify(launchOptions)}`);
      browser = await puppeteer.launch(launchOptions);
      page = await browser.newPage();
      await page.setUserAgent(userAgent);

      // Intenta con cookies
      try {
        const cookies = await loadCookies(page, username);
        if (cookies) {
          logger.info('🍪 Cookies cargadas exitosamente');
          await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle2' });

          if (await isSessionValid(page)) {
            logger.info('✅ Sesión válida con cookies');
            return page;
          } else {
            logger.info('⚠️ Sesión inválida, haciendo login manual...');
          }
        }
      } catch (e) {
        logger.warn(`⚠️ Error cargando cookies: ${e.message}`);
      }

      // Login manual
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
        return page;
      } else {
        throw new Error('Login fallido');
      }

    } catch (err) {
      logger.error(`❌ Error en intento ${attempt}: ${err.message}`);
      if (browser) await browser.close().catch(() => {});
      if (proxyUrl) await proxyChain.closeAnonymizedProxy(proxyUrl).catch(() => {});
    }
  }

  const error = new Error('❌ Login fallido después de múltiples intentos');
  logger.error(error.message);
  throw error;
}

module.exports = { smartLogin };
