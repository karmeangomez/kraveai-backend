import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { v4 as uuidv4 } from 'uuid';
import {
  getRandomName,
  generateEmail
} from '../utils/nombre_utils.js';
import {
  humanType,
  randomDelay,
  simulateMouseMovement,
  humanInteraction
} from '../utils/humanActions.js';
import ProxyRotationSystem from '../proxies/proxyRotationSystem.js';
import AccountManager from './accountManager.js';
import emailManager from '../email/emailManager.js';

puppeteer.use(StealthPlugin());

const logger = {
  info: msg => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`),
  error: msg => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`)
};

export default async function crearCuentaInstagram(proxySystem) {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/usr/bin/chromium-browser',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  let proxyObj = proxySystem.getBestProxy?.() || null;
  const proxyStr = proxyObj?.string || 'none';

  try {
    if (proxyObj) {
      logger.info(`🛡️ Usando proxy: ${proxyStr}`);
      await page.authenticate(proxyObj.auth);
    } else {
      logger.warn('⚠️ Sin proxy, continúa en IP local');
    }

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    await page.goto('https://www.instagram.com/accounts/emailsignup/', {
      waitUntil: 'networkidle2'
    });

    await randomDelay(2000, 5000);
    await simulateMouseMovement(page);

    const { firstName, lastName } = getRandomName();
    const username = `${firstName.toLowerCase()}${lastName.toLowerCase()}${Math.floor(Math.random() * 1000)}`;
    const password = `${firstName}${lastName}${Math.random().toString(36).slice(-4)}!`;
    const email = generateEmail();

    await humanInteraction(page);
    await humanType(page, 'input[name="emailOrPhone"]', email);
    await humanType(page, 'input[name="fullName"]', `${firstName} ${lastName}`);
    await humanType(page, 'input[name="username"]', username);
    await humanType(page, 'input[name="password"]', password);

    await randomDelay(1000, 3000);
    const signUpButton = await page.$('button[type="submit"]');
    if (!signUpButton) throw new Error('No se encontró el botón de registro');
    await signUpButton.click();

    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
    const code = await emailManager.waitForCode(email);

    await humanType(page, 'input[name="email_confirmation_code"]', code);
    await simulateMouseMovement(page);
    await humanType(page, 'button[type="submit"]');

    const account = {
      id: uuidv4(),
      username,
      email,
      password,
      proxy: proxyStr,
      status: 'created'
    };

    AccountManager.addAccount(account);
    if (proxyObj) proxySystem.markProxyUsed(proxyStr);

    await browser.close();
    return account;

  } catch (error) {
    logger.error(`❌ Error creando cuenta: ${error.message}`);

    if (proxyObj) proxySystem.recordFailure(proxyStr);

    const failed = {
      id: uuidv4(),
      username: '',
      email: '',
      password: '',
      proxy: proxyStr,
      status: 'failed',
      error: error.message
    };

    AccountManager.addAccount(failed);
    await browser.close();
    return failed;
  }
}
