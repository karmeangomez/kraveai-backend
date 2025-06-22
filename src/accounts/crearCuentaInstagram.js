// src/accounts/crearCuentaInstagram.js
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generarNombreCompleto, generarNombreUsuario } from '../utils/nombre_utils.js';
import emailManager from '../email/emailManager.js';
import proxySystem from '../proxies/proxyRotationSystem.js';
import { v4 as uuidv4 } from 'uuid';

puppeteer.use(StealthPlugin());
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function crearCuentaInstagram() {
  const proxy = proxySystem.getBestProxy();
  const proxyUrl = `http://${proxy.auth.username}:${proxy.auth.password}@${proxy.ip}:${proxy.port}`;
  const proxyArg = `--proxy-server=${proxyUrl}`;

  let browser;
  let page;
  let email = '';
  let username = '';
  let fullName = '';
  let password = '';

  try {
    console.log(`[INFO] 🛡️ Usando proxy: ${proxy.string}`);

    // Generar datos
    fullName = generarNombreCompleto();
    username = generarNombreUsuario();
    password = `${uuidv4().slice(0, 8)}Aa!`;

    email = await emailManager.getRandomEmail();
    console.log(`📨 Email generado: ${email}`);

    browser = await puppeteer.launch({
      headless: true,
      args: [
        proxyArg,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage'
      ]
    });

    page = await browser.newPage();

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36');
    await page.goto('https://www.instagram.com/accounts/emailsignup/', { waitUntil: 'networkidle2', timeout: 60000 });

    await page.waitForSelector('input[name="emailOrPhone"]');
    await page.type('input[name="emailOrPhone"]', email, { delay: 100 });
    await page.type('input[name="fullName"]', fullName, { delay: 100 });
    await page.type('input[name="username"]', username, { delay: 100 });
    await page.type('input[name="password"]', password, { delay: 100 });

    await page.waitForTimeout(2000);
    const buttons = await page.$x("//button[contains(., 'Siguiente')]");
    if (buttons.length > 0) await buttons[0].click();
    else throw new Error('No se encontró botón "Siguiente"');

    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });

    const cookies = await page.cookies();
    const cookiePath = path.join(__dirname, `../cookies/${username}.json`);
    fs.writeFileSync(cookiePath, JSON.stringify(cookies, null, 2));

    const cuenta = {
      username,
      password,
      email,
      nombre: fullName,
      fecha: new Date().toISOString(),
      cookies: `cookies/${username}.json`
    };

    const cuentasPath = path.join(__dirname, '../cuentas_creadas.json');
    let cuentas = [];
    if (fs.existsSync(cuentasPath)) {
      cuentas = JSON.parse(fs.readFileSync(cuentasPath));
    }
    cuentas.push(cuenta);
    fs.writeFileSync(cuentasPath, JSON.stringify(cuentas, null, 2));

    console.log(`✅ Cuenta creada: @${username}`);
    proxySystem.recordSuccess(proxy.string);
    return cuenta;

  } catch (err) {
    console.error(`❌ Error creando cuenta: ${err.message}`);
    if (proxy && proxy.string) proxySystem.recordFailure(proxy.string);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}

export default crearCuentaInstagram;
