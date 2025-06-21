import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { v4 as uuidv4 } from 'uuid';
import { getRandomName } from '../utils/nombre_utils.js';
import {
  humanType,
  randomDelay,
  simulateMouseMovement,
  humanInteraction
} from '../utils/humanActions.js';
import ProxyRotationSystem from '../proxies/proxyRotationSystem.js';
import AccountManager from './accountManager.js';
import EmailManager from '../email/emailManager.js'; // ✅ CORREGIDO

puppeteer.use(StealthPlugin());

const logger = {
  info: (msg) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`),
  error: (msg) => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`)
};

async function crearCuentaInstagram() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    executablePath: '/usr/bin/chromium-browser'
  });

  const page = await browser.newPage();

  const proxyObj = ProxyRotationSystem.getBestProxy();
  const proxyStr = proxyObj ? proxyObj.string : 'none';

  const emailClient = new EmailManager(proxyObj); // ✅ CORREGIDO
  const email = await emailClient.getRandomEmail(); // ✅ CORREGIDO

  try {
    if (!proxyObj) {
      logger.info('⚠️ Sin proxy, continúa en IP local');
    } else {
      logger.info(`🛡️ Usando proxy: ${proxyStr}`);
      await page.authenticate(proxyObj.auth);
    }

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    await page.goto('https://www.instagram.com/accounts/emailsignup/', { waitUntil: 'networkidle2' });

    await simulateMouseMovement(page);
    await randomDelay(2000, 4000);

    const { firstName, lastName } = getRandomName();
    const username = `${firstName.toLowerCase()}${lastName.toLowerCase()}${Math.floor(Math.random() * 1000)}`;
    const password = `${firstName}${lastName}${Math.random().toString(36).slice(-4)}!`;

    await humanInteraction(page);
    await humanType(page, 'input[name="emailOrPhone"]', email);
    await humanType(page, 'input[name="fullName"]', `${firstName} ${lastName}`);
    await humanType(page, 'input[name="username"]', username);
    await humanType(page, 'input[name="password"]', password);

    const signUpButton = await page.$('button[type="submit"]');
    if (!signUpButton) throw new Error('No se encontró el botón de registro');

    await signUpButton.click();
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});

    const account = {
      id: uuidv4(),
      username,
      email,
      password,
      proxy: proxyStr,
      status: 'created'
    };

    AccountManager.addAccount(account);
    if (proxyObj) ProxyRotationSystem.markProxyUsed(proxyStr);

    await browser.close();
    return account;

  } catch (error) {
    logger.error(`❌ Error creando cuenta: ${error.message}`);
    if (proxyObj) ProxyRotationSystem.recordFailure(proxyStr);

    const failedAccount = {
      id: uuidv4(),
      username: '',
      email: '',
      password: '',
      proxy: proxyStr,
      status: 'failed',
      error: error.message
    };

    AccountManager.addAccount(failedAccount);
    await browser.close();
    return failedAccount;
  }
}

export default crearCuentaInstagram;
