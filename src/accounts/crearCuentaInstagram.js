import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Importaciones corregidas
import ProxyRotationSystem from '../proxies/proxyRotationSystem.js';
import EmailManager from '../email/emailManager.js';
import AccountManager from './accountManager.js';
import { 
  generarNombreCompleto, 
  generarNombreUsuario,
  generarEmail
} from '../utils/nombre_utils.js';
import { generateRussianFingerprint } from '../fingerprints/generator.js';
import { humanType, randomDelay, simulateMouseMovement } from '../utils/humanActions.js';

// Configuración de entorno
dotenv.config();

// Activar plugin Stealth
puppeteer.use(StealthPlugin());

// Configuración global
const SCREENSHOTS_DIR = path.resolve('screenshots');
const LOGS_DIR = path.resolve('logs');
const COOKIES_DIR = path.resolve('cookies');

// Crear directorios si no existen
[SCREENSHOTS_DIR, LOGS_DIR, COOKIES_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const logger = {
  info: (msg) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`),
  error: (msg) => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`),
  debug: (msg) => process.env.DEBUG_MODE === 'true' && console.debug(`[DEBUG] ${new Date().toISOString()} - ${msg}`)
};

async function crearCuentaInstagram() {
  let browser;
  let page;
  const accountData = {
    id: uuidv4(),
    username: '',
    email: '',
    password: generatePassword(),
    status: 'started',
    proxy: null,
    emailService: null,
    error: null,
    screenshots: [],
    cookiesFile: null
  };

  try {
    // 1. Obtener proxy
    const proxy = ProxyRotationSystem.getBestProxy();
    if (!proxy) throw new Error('No hay proxies disponibles');
    accountData.proxy = proxy.string;

    // 2. Generar datos de usuario
    accountData.username = generarNombreUsuario();
    const fullName = generarNombreCompleto();
    accountData.email = generarEmail(accountData.username);

    // 3. Configurar fingerprint
    const fingerprint = {
      ...generateRussianFingerprint(),
      fullName,
      username: accountData.username,
      email: accountData.email
    };

    // 4. Configurar navegador
    browser = await puppeteer.launch({
      headless: true,
      executablePath: '/usr/bin/chromium-browser',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        `--proxy-server=${proxy.string}`,
        `--user-agent=${fingerprint.userAgent}`
      ]
    });

    page = await browser.newPage();

    // 5. Autenticación proxy si es necesario
    if (proxy.auth) {
      await page.authenticate({
        username: proxy.auth.username,
        password: proxy.auth.password
      });
    }

    // 6. Navegar a Instagram
    await page.goto('https://www.instagram.com/accounts/emailsignup/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // 7. Rellenar formulario
    await humanType(page, 'input[name="emailOrPhone"]', accountData.email);
    await randomDelay(1000, 2000);
    
    await humanType(page, 'input[name="fullName"]', fullName);
    await randomDelay(500, 1500);
    
    await humanType(page, 'input[name="username"]', accountData.username);
    await randomDelay(1000, 2500);
    
    await humanType(page, 'input[name="password"]', accountData.password);
    await randomDelay(2000, 3000);

    // 8. Hacer clic en Registrarse
    await simulateMouseMovement(page);
    await page.click('button[type="submit"]');
    await randomDelay(3000, 5000);

    // 9. Manejar verificación de email (simplificado)
    const emailManager = new EmailManager(proxy);
    const verificationCode = await emailManager.getVerificationCode();
    if (!verificationCode) throw new Error('No se recibió código de verificación');
    
    await humanType(page, 'input[name="email_confirmation_code"]', verificationCode);
    await randomDelay(2000, 4000);

    // 10. Verificar creación exitosa
    await page.waitForSelector('nav[role="navigation"]', { timeout: 15000 });
    accountData.status = 'created';

    // 11. Guardar datos
    accountData.cookiesFile = await saveCookies(page, accountData.username);
    AccountManager.addAccount(accountData);

    logger.info(`✅ Cuenta creada: @${accountData.username}`);
    return accountData;

  } catch (error) {
    accountData.status = 'failed';
    accountData.error = error.message;
    logger.error(`❌ Error: ${error.message}`);
    
    if (accountData.proxy) {
      ProxyRotationSystem.recordFailure(accountData.proxy);
    }
    
    return accountData;
  } finally {
    if (browser) await browser.close();
  }
}

// Funciones auxiliares CORREGIDAS
async function saveCookies(page, username) {
  const cookies = await page.cookies();
  const cookiePath = path.join(COOKIES_DIR, `${username}_cookies.json`);
  fs.writeFileSync(cookiePath, JSON.stringify(cookies, null, 2));
  return cookiePath;
}

function generatePassword(length = 12) {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()';
  return Array.from({ length }, () => 
    charset.charAt(Math.floor(Math.random() * charset.length))
  ).join('');
}

export default crearCuentaInstagram;
