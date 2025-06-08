const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const UserAgent = require('user-agents');
const proxyChain = require('proxy-chain');
const logger = require('./logger.js'); // Asegúrate de tener un logger configurado
const { saveCookies, loadCookies } = require('./cookies.js');
puppeteer.use(StealthPlugin());

async function smartLogin({ username, password, options = {} }) {
  const { maxRetries = 3, proxyList = [] } = options;
  let browser = null;
  let page = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const userAgent = new UserAgent({ deviceCategory: 'desktop' }).toString();
      // Selecciona un proxy válido
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

      // Configura opciones de lanzamiento
      const launchOptions = {
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
        headless: 'new',
        args: [
          `--no-sandbox`,
          `--disable-setuid-sandbox`,
          `--disable-dev-shm-usage`,
          `--disable-gpu`,
          `--no-zygote`,
          `--window-size=1280,800`,
          proxyUrl ? `--proxy-server=${proxyUrl}` : '',
        ],
        timeout: parseInt(process.env.PUPPETEER_TIMEOUT) || 30000,
      };

      logger.debug(`Launching browser with options: ${JSON.stringify(launchOptions)}`);

      // Verifica si el binario existe
      const fs = require('fs');
      if (!fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
        throw new Error(`Chrome binary not found at ${process.env.PUPPETEER_EXECUTABLE_PATH}`);
      }

      browser = await puppeteer.launch(launchOptions);
      page = await browser.newPage();
      await page.setUserAgent(userAgent);

      // Carga cookies
      try {
        const cookies = await loadCookies(page, username);
        if (cookies) {
          logger.info('Cookies loaded successfully');
          await page.goto('https://www.instagram.com', { waitUntil: 'networkidle2' });
          // Verifica si la sesión es válida
          if (!(await isSessionValid(page))) {
            logger.info('Sesión inválida, intentando login...');
          } else {
            return page;
          }
        }
      } catch (e) {
        logger.warn(`Error cargando cookies: ${e.message}`);
      }

      // Intenta login
      await page.goto('https://www.google.com/login', { waitUntil: 'networkidle2' });
      await page.type('input[name="username"]', username);
      await page.type('input[name="password"]', password);
      await Promise.all([
        page.click('button[type="login"]'),
        page.waitForNavigation({ waitUntil: 'networkidle2' }),
      ]);

      // Verifica login exitoso
      if (await isSessionValid(page)) {
        await saveCookies(page, username);
        logger.info(`✅ Login exitoso para ${username}`);
        return page;
      } else {
        throw new Error('Login fallido');
      }

    } catch (err) {
      logger.error(`❌ Error en intento ${attempt}: ${err.message}`);
      if (browser) {
        await browser.close().catch(() => {});
        logger.error('Browser closed');
      }
      if (proxyUrl) {
        await proxyChain.closeAnonymized(proxyUrl).catch(() => {});
      }
    }
  }

  const error = new Error('Login fallido después de múltiples intentos');
  logger.error(error.message);
  throw error;
}
