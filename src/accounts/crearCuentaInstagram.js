import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { v4 as uuidv4 } from 'uuid';
import nombreUtils from '../utils/nombre_utils.js';
import humanActions from '../utils/humanActions.js';
import ProxyRotationSystem from '../proxies/proxyRotationSystem.js';
import AccountManager from './accountManager.js';
import emailManager from '../email/emailManager.js';

puppeteer.use(StealthPlugin());

const logger = {
  info: (msg) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`),
  error: (msg) => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`)
};

async function crearCuentaInstagram(proxySystem) {
  const accountData = {
    id: uuidv4(),
    status: 'pending',
    attempts: 1
  };

  let browser;

  try {
    // 1. Obtener proxy
    let proxy = null;
    try {
      proxy = proxySystem.getBestProxy();
      accountData.proxy = proxy.string;
      logger.info(`🛡️ Usando proxy: ${proxy.string}`);
    } catch (e) {
      logger.info('⚠️ Sin proxy, continúa en IP local');
      accountData.proxy = 'none';
    }

    // 2. Generar identidad
    accountData.fullName = nombreUtils.generateRussianName();
    accountData.username = nombreUtils.generateUsername();
    accountData.password = Math.random().toString(36).slice(-10);
    accountData.email = await emailManager.getRandomEmail();

    // 3. Fingerprint y navegador
    const fingerprint = {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.117 Safari/537.36',
      resolution: { width: 1280, height: 720 },
      language: 'es-ES,es'
    };

    const launchOptions = {
      headless: true,
      executablePath: '/usr/bin/chromium-browser',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    };

    if (proxy) {
      launchOptions.args.push(`--proxy-server=${proxy.ip}:${proxy.port}`);
    }

    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    if (proxy?.auth) {
      await page.authenticate(proxy.auth);
    }

    await page.setUserAgent(fingerprint.userAgent);
    await page.setViewport(fingerprint.resolution);
    await page.setExtraHTTPHeaders({ 'Accept-Language': fingerprint.language });

    // 4. Formulario de registro
    await page.goto('https://www.instagram.com/accounts/emailsignup/', { waitUntil: 'networkidle2' });
    await humanActions.waitRandomDelay();
    await humanActions.simulateMouseMovement(page);

    await humanActions.humanType(page, 'input[name="emailOrPhone"]', accountData.email);
    await humanActions.humanType(page, 'input[name="fullName"]', accountData.fullName);
    await humanActions.humanType(page, 'input[name="username"]', accountData.username);
    await humanActions.humanType(page, 'input[name="password"]', accountData.password);

    await humanActions.waitRandomDelay();
    await humanActions.simulateMouseMovement(page);

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2' }),
      humanActions.clickLikeHuman(page, 'button[type="submit"]')
    ]);

    // 5. Código de verificación
    const code = await emailManager.waitForCode(accountData.email);
    await humanActions.humanType(page, 'input[name="email_confirmation_code"]', code);
    await humanActions.simulateMouseMovement(page);
    await humanActions.clickLikeHuman(page, 'button[type="submit"]');
    await humanActions.waitRandomDelay();

    // 6. Verificación de creación
    await page.waitForTimeout(5000);
    const currentUrl = page.url();
    if (currentUrl.includes('/accounts/')) {
      throw new Error('Redirigido a página de error de cuenta');
    }

    // 7. Guardado y finalización
    accountData.status = 'created';
    accountData.cookiesPath = `cookies/${accountData.username}.json`;

    const cookies = await page.cookies();
    await fs.promises.writeFile(accountData.cookiesPath, JSON.stringify(cookies, null, 2));
    const screenshotPath = `screenshots/${accountData.username}_final.png`;
    await page.screenshot({ path: screenshotPath });
    accountData.screenshotPath = screenshotPath;

    if (proxy) {
      proxySystem.recordSuccess(proxy.string);
    }

    AccountManager.addAccount(accountData);
    return accountData;

  } catch (error) {
    accountData.status = 'failed';
    accountData.error = error.message;
    AccountManager.addAccount(accountData);

    if (proxy) {
      proxySystem.recordFailure(proxy.string);
    }

    logger.error(`❌ Error creando cuenta: ${error.message}`);
    return accountData;
  } finally {
    if (browser) await browser.close();
  }
}

export { crearCuentaInstagram };

