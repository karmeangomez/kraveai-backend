// src/accounts/crearCuentaInstagram.js
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import ProxyRotationSystem from '../proxies/proxyRotationSystem.js';
import emailManager from '../email/emailManager.js';
import { generateLatinoName, generateLatinoUsername } from '../utils/nombre_utils.js'; // Actualizado a latino
import { humanType, randomDelay, moveMouse } from '../utils/humanActions.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

puppeteer.use(StealthPlugin());
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Bandera para inicializar el sistema de proxies solo una vez
let proxySystemInitialized = false;

async function safeInteract(page, selector, action, value = '') {
  try {
    await page.waitForSelector(selector, { timeout: 10000 });
    await action(page, selector, value);
  } catch (e) {
    throw new Error(`⚠️ Error con selector ${selector}: ${e.message}`);
  }
}

export default async function crearCuentaInstagram() {
  // Inicializar sistema de proxies solo una vez
  if (!proxySystemInitialized) {
    await ProxyRotationSystem.initialize();
    proxySystemInitialized = true;
    console.log('✅ Sistema de proxies inicializado');
  }

  const nombreCompleto = generateLatinoName(); // Nombre latino
  const username = generateLatinoUsername();   // Usuario latino
  const password = `Insta@${Math.floor(Math.random() * 10000)}`;

  // Obtener proxy usando el nuevo sistema
  const proxy = ProxyRotationSystem.getNextProxy();
  if (!proxy) throw new Error('Proxy no disponible');

  // Parsear el nuevo formato de proxy (ip:port:user:pass)
  const proxyParts = proxy.proxy.split(':');
  const ip = proxyParts[0];
  const port = proxyParts[1];
  const user = proxyParts[2];
  const pass = proxyParts[3];

  const proxyStr = user && pass 
      ? `http://${user}:${pass}@${ip}:${port}`
      : `http://${ip}:${port}`;

  let browser;
  try {
    const email = await emailManager.getRandomEmail();

    browser = await puppeteer.launch({
      headless: false, // VISUAL
      args: [
        `--proxy-server=${proxyStr}`,
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ],
      defaultViewport: null
    });

    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', req => {
      const blockTypes = ['image', 'stylesheet', 'font'];
      if (blockTypes.includes(req.resourceType())) req.abort();
      else req.continue();
    });

    await page.goto('https://www.instagram.com/accounts/emailsignup/', { timeout: 45000 });

    await randomDelay();
    await safeInteract(page, 'input[name="emailOrPhone"]', humanType, email);
    await safeInteract(page, 'input[name="fullName"]', humanType, nombreCompleto);
    await safeInteract(page, 'input[name="username"]', humanType, username);
    await safeInteract(page, 'input[name="password"]', humanType, password);
    await moveMouse(page);
    await randomDelay();

    await safeInteract(page, 'button[type="submit"]', async (p, s) => p.click(s));
    await page.waitForTimeout(5000);

    const codeInput = await page.$('input[name="email_confirmation_code"]');
    if (codeInput) {
      const code = await emailManager.getVerificationCode(email);
      await humanType(page, 'input[name="email_confirmation_code"]', code);
      await randomDelay();
      await page.click('button[type="submit"]');
    }

    const profileUrl = `https://www.instagram.com/${username}/`;
    const response = await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const exists = response && response.status && response.status() === 200;

    if (!exists) throw new Error('Cuenta creada no es pública');

    const cookies = await page.cookies();
    const cookiesPath = path.join(__dirname, `../cookies/${username}.json`);
    fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));

    const cuentasPath = path.join(__dirname, '../cuentas_creadas.json');
    const nuevaCuenta = {
      username,
      password,
      email,
      proxy: proxyStr,
      createdAt: new Date().toISOString(),
      status: 'created',
      proxyScore: proxy.score,  // Calidad del proxy
      latency: proxy.latency,   // Rendimiento del proxy
      country: 'LATAM'          // País de origen
    };
    
    const cuentas = fs.existsSync(cuentasPath)
      ? JSON.parse(fs.readFileSync(cuentasPath, 'utf8'))
      : [];
    cuentas.push(nuevaCuenta);
    fs.writeFileSync(cuentasPath, JSON.stringify(cuentas, null, 2));

    console.log(`✅ Cuenta latina creada con proxy ${ip} (Score: ${proxy.score}, Latencia: ${proxy.latency}ms)`);
    return nuevaCuenta;
  } catch (error) {
    const logsDir = path.join(__dirname, '../logs');
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir);

    const screenshotPath = path.join(logsDir, `error_${Date.now()}.png`);
    if (browser) {
      const pages = await browser.pages();
      if (pages[0]) await pages[0].screenshot({ path: screenshotPath });
    }

    console.error(`❌ Error creando cuenta latina con proxy ${ip}:${port}: ${error.message}`);
    return null;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
