import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getRandomName, generateUsername } from '../utils/nombre_utils.js';
import ProxyRotationSystem from '../proxies/proxyRotationSystem.js';
import EmailManager from '../email/emailManager.js';
import { humanType, randomDelay, simulateMouseMovement } from '../utils/humanActions.js';

puppeteer.use(StealthPlugin());

export default async function crearCuentaInstagram() {
  const id = uuidv4();
  const { firstName, lastName } = getRandomName();
  const username = generateUsername();
  const password = `${firstName}${lastName}${Math.floor(Math.random() * 10000)}!`;

  const proxy = ProxyRotationSystem.getBestProxy();
  const emailManager = new EmailManager();
  let email;

  try {
    email = await emailManager.getRandomEmail();
  } catch (e) {
    email = `fail_${Date.now()}@fallback.com`;
  }

  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu'
  ];

  if (proxy?.string) args.push(`--proxy-server=${proxy.string}`);

  const browser = await puppeteer.launch({
    headless: true,
    args,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser'
  });

  const page = await browser.newPage();

  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36');
    await page.goto('https://www.instagram.com/accounts/emailsignup/', { waitUntil: 'networkidle2' });

    await simulateMouseMovement(page);
    await humanType(page, 'input[name="emailOrPhone"]', email);
    await humanType(page, 'input[name="fullName"]', `${firstName} ${lastName}`);
    await humanType(page, 'input[name="username"]', username);
    await humanType(page, 'input[name="password"]', password);

    const signUpButton = await page.$('button[type="submit"]');
    if (!signUpButton) throw new Error('Botón de registro no encontrado');
    await signUpButton.click();

    await page.waitForTimeout(10000);

    // Comprobar si redirige a la home (indicador de éxito)
    const currentUrl = page.url();
    if (currentUrl.includes('challenge') || currentUrl.includes('emailsignup')) {
      throw new Error('No se logró completar el registro');
    }

    // Guardar cookies
    const cookies = await page.cookies();
    const cookiesPath = path.join('cookies', `${username}.json`);
    fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));

    // Guardar cuenta
    const account = {
      id,
      username,
      email,
      password,
      proxy: proxy?.string || 'local',
      status: 'created'
    };

    const accountsPath = path.join('cuentas_creadas.json');
    const cuentas = fs.existsSync(accountsPath) ? JSON.parse(fs.readFileSync(accountsPath)) : [];
    cuentas.push(account);
    fs.writeFileSync(accountsPath, JSON.stringify(cuentas, null, 2));

    await browser.close();
    return account;

  } catch (error) {
    if (proxy?.string) ProxyRotationSystem.recordFailure(proxy.string);
    await browser.close();
    return {
      id,
      username,
      email,
      password,
      proxy: proxy?.string || 'local',
      status: 'failed',
      error: error.message
    };
  }
}
