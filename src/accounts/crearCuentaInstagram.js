import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

import ProxyRotationSystem from '../proxies/proxyRotationSystem.js';
import EmailManager from '../email/emailManager.js';
import AccountManager from './accountManager.js';
import { generarNombreCompleto, generarNombreUsuario } from '../utils/nombre_utils.js';
import { humanType, randomDelay, simulateMouseMovement, humanInteraction } from '../utils/humanActions.js';

puppeteer.use(StealthPlugin());

const logger = {
  info: (msg) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`),
  error: (msg) => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`)
};

async function crearCuentaInstagram() {
  const proxyObj = ProxyRotationSystem.getBestProxy();
  const proxyStr = proxyObj ? proxyObj.string : 'none';

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      proxyObj ? `--proxy-server=${proxyObj.string}` : null
    ].filter(Boolean),
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser'
  });

  const page = await browser.newPage();

  if (proxyObj?.auth) {
    await page.authenticate(proxyObj.auth);
  }

  try {
    const fullName = generarNombreCompleto();
    const username = generarNombreUsuario(fullName);
    const password = `${username}${Math.random().toString(36).slice(-4)}!`;
    const emailManager = new EmailManager(proxyObj);
    const email = await emailManager.getRandomEmail();

    // Fingerprint & contexto realista
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36');
    await page.setViewport({ width: 390, height: 844 });
    await page.goto('https://www.instagram.com/accounts/emailsignup/', { waitUntil: 'networkidle2' });
    await simulateMouseMovement(page);
    await humanInteraction(page);
    await randomDelay(3000, 7000);

    await humanType(page, 'input[name="emailOrPhone"]', email);
    await humanType(page, 'input[name="fullName"]', fullName);
    await humanType(page, 'input[name="username"]', username);
    await humanType(page, 'input[name="password"]', password);

    const btn = await page.$('button[type="submit"]');
    await btn.click();

    await page.waitForTimeout(10000); // esperar carga
    const code = await emailManager.waitForCode(email);
    const codeInput = await page.$('input[name="email_confirmation_code"]');
    if (codeInput) {
      await humanType(page, 'input[name="email_confirmation_code"]', code);
      await page.keyboard.press('Enter');
    }

    await page.waitForTimeout(5000);

    // Verificar existencia real de cuenta
    const check = await page.goto(`https://www.instagram.com/${username}`, { waitUntil: 'domcontentloaded' });
    const exists = check.status() === 200;

    if (!exists) throw new Error('Cuenta no encontrada en Instagram (post-verificación)');

    const cookies = await page.cookies();
    const account = {
      id: uuidv4(),
      username,
      password,
      email,
      proxy: proxyStr,
      status: 'created',
      timestamp: new Date().toISOString()
    };

    // Guardar cookies por usuario
    const cookiesPath = path.resolve(`cookies/${username}.json`);
    fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));

    // Añadir a lista
    AccountManager.addAccount(account);
    if (proxyObj) ProxyRotationSystem.markProxyUsed(proxyStr);
    logger.info(`✅ Cuenta añadida: ${username}`);

    await browser.close();
    return account;

  } catch (error) {
    logger.error(`❌ Error creando cuenta: ${error.message}`);
    if (proxyObj) ProxyRotationSystem.recordFailure(proxyStr);
    await browser.close();
    return {
      id: uuidv4(),
      username: '',
      email: '',
      password: '',
      proxy: proxyStr,
      status: 'failed',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

export default crearCuentaInstagram;
