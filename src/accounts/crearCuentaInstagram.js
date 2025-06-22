import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import proxyRotationSystem from '../proxies/proxyRotationSystem.js';
import emailManager from '../email/emailManager.js';
import { generateRussianName, generateUsername } from '../utils/nombre_utils.js';
import { humanType, randomDelay, moveMouse } from '../utils/humanActions.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

puppeteer.use(StealthPlugin());
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default async function crearCuentaInstagram() {
  const nombreCompleto = generateRussianName();
  const username = generateUsername();
  const password = `Insta@${Math.floor(Math.random() * 10000)}r`;

  const proxy = proxyRotationSystem.getBestProxy();
  if (!proxy) throw new Error('Proxy no disponible');

  const proxyStr = proxy.auth
    ? `${proxy.type || 'http'}://${proxy.auth.username}:${proxy.auth.password}@${proxy.ip}:${proxy.port}`
    : `${proxy.type || 'http'}://${proxy.ip}:${proxy.port}`;

  let browser;
  try {
    const email = await emailManager.getRandomEmail();

    browser = await puppeteer.launch({
      headless: true,
      args: [
        `--proxy-server=${proxyStr}`,
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    });

    const page = await browser.newPage();
    await page.goto('https://www.instagram.com/accounts/emailsignup/', { timeout: 45000 });

    await randomDelay();
    await humanType(page, 'input[name="emailOrPhone"]', email);
    await humanType(page, 'input[name="fullName"]', nombreCompleto);
    await humanType(page, 'input[name="username"]', username);
    await humanType(page, 'input[name="password"]', password);

    await moveMouse(page);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);

    // Esperar código y ponerlo si lo pide
    const code = await emailManager.getVerificationCode(email);
    const codeInput = await page.$('input[name="email_confirmation_code"]');
    if (codeInput) {
      await humanType(page, 'input[name="email_confirmation_code"]', code);
      await page.click('button[type="submit"]');
    }

    // Verificar si la cuenta existe públicamente
    const profileUrl = `https://www.instagram.com/${username}/`;
    const response = await page.goto(profileUrl, { timeout: 30000 });
    const exists = response.status() === 200;

    if (!exists) throw new Error('La cuenta no existe públicamente');

    // Guardar cookies
    const cookies = await page.cookies();
    const cookiesPath = path.join(__dirname, `../cookies/${username}.json`);
    fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));

    // Guardar cuenta creada
    const cuentasPath = path.join(__dirname, '../cuentas_creadas.json');
    const nuevaCuenta = { username, password, email, proxy: proxyStr, createdAt: new Date().toISOString() };
    const cuentas = fs.existsSync(cuentasPath) ? JSON.parse(fs.readFileSync(cuentasPath)) : [];
    cuentas.push(nuevaCuenta);
    fs.writeFileSync(cuentasPath, JSON.stringify(cuentas, null, 2));

    proxyRotationSystem.recordSuccess(proxy.string);
    return nuevaCuenta;

  } catch (error) {
    proxyRotationSystem.recordFailure(proxy?.string || 'N/A');
    console.error(`❌ Error creando cuenta: ${error.message}`);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}
