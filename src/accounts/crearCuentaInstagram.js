import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generarNombreUsuario, getRandomName } from '../utils/nombre_utils.js';
import proxyRotationSystem from '../proxies/proxyRotationSystem.js';
import EmailManager from '../email/emailManager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
puppeteer.use(StealthPlugin());

async function crearCuentaInstagram() {
  const { firstName, lastName } = getRandomName();
  const username = generarNombreUsuario();
  const password = 'kraveAIBot@123';
  let email = '';
  let proxyObj;
  let browser;

  try {
    // ✅ Corrección aquí: usamos el singleton EmailManager directamente
    email = await EmailManager.getRandomEmail();

    // Obtener proxy válido
    proxyObj = proxyRotationSystem.getBestProxy();
    const proxyUrl = `http://${proxyObj.auth.username}:${proxyObj.auth.password}@${proxyObj.ip}:${proxyObj.port}`;

    const args = [
      `--proxy-server=http=${proxyObj.ip}:${proxyObj.port}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--lang=es-ES',
      '--window-size=360,640'
    ];

    browser = await puppeteer.launch({
      headless: true,
      args
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36'
    );

    await page.goto('https://www.instagram.com/accounts/emailsignup/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await page.waitForSelector('input[name="emailOrPhone"]', { timeout: 15000 });
    await page.type('input[name="emailOrPhone"]', email, { delay: 100 });
    await page.type('input[name="fullName"]', `${firstName} ${lastName}`, { delay: 100 });
    await page.type('input[name="username"]', username, { delay: 100 });
    await page.type('input[name="password"]', password, { delay: 100 });

    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);

    // Validar si se creó exitosamente accediendo al perfil
    const profileUrl = `https://www.instagram.com/${username}`;
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const notFound = await page.$x("//*[contains(text(),'Esta página no está disponible')]");
    if (notFound.length > 0) {
      throw new Error('Instagram no reconoce el perfil creado');
    }

    // Guardar cookies
    const cookies = await page.cookies();
    const cookiePath = path.join(__dirname, `../cookies/${username}.json`);
    fs.writeFileSync(cookiePath, JSON.stringify(cookies, null, 2));

    // Guardar cuenta
    const cuenta = {
      username,
      password,
      email,
      cookies_path: `cookies/${username}.json`,
      created_at: new Date().toISOString()
    };

    const cuentasPath = path.join(__dirname, '../data/cuentas_creadas.json');
    let cuentas = [];
    if (fs.existsSync(cuentasPath)) {
      cuentas = JSON.parse(fs.readFileSync(cuentasPath, 'utf8'));
    }
    cuentas.push(cuenta);
    fs.writeFileSync(cuentasPath, JSON.stringify(cuentas, null, 2));

    console.log(`✅ Cuenta creada y confirmada: @${username}`);
    proxyRotationSystem.recordSuccess(proxyObj.string);
    return cuenta;

  } catch (err) {
    console.error('❌ Error creando o validando cuenta:', err.message);
    if (proxyObj) proxyRotationSystem.recordFailure(proxyObj.string);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}

export default crearCuentaInstagram;
