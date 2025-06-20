// src/accounts/crearCuentaInstagram.js
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Importaciones de tus módulos
import ProxyRotationSystem from '../proxies/proxyRotationSystem.js'; // Sistema de rotación de proxies
import EmailManager from '../email/emailManager.js';
import AccountManager from './accountManager.js';
import { generar_nombre, generar_usuario } from '../utils/nombre_utils.js'; // Tu módulo de nombres latinos
import { generateRussianFingerprint } from '../fingerprints/generator.js';
import { humanType, randomDelay, simulateMouseMovement } from '../utils/humanActions.js';

// Configuración de entorno
dotenv.config();

// Activar plugin Stealth
puppeteer.use(StealthPlugin());

// Configuración global
const SCREENSHOTS_DIR = path.resolve('screenshots');
const LOGS_DIR = path.resolve('logs');
const COOKIES_DIR = path.resolve('cookies'); // Directorio para cookies

// Crear directorios si no existen
[SCREENSHOTS_DIR, LOGS_DIR, COOKIES_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Logger mejorado
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
    password: '',
    status: 'started',
    proxy: null,
    emailService: null,
    error: null,
    screenshots: [],
    cookiesFile: null
  };

  try {
    // 1. Obtener el MEJOR proxy disponible usando ProxyRotationSystem
    const proxy = ProxyRotationSystem.getBestProxy();
    if (!proxy) throw new Error('No hay proxies premium disponibles');
    
    accountData.proxy = proxy.string;
    logger.info(`🛡️ Usando proxy premium: ${proxy.ip}:${proxy.port}`);

    // 2. Generar huella digital combinada (rusa + tu módulo latino)
    const fingerprint = {
      ...generateRussianFingerprint(),
      fullName: generar_nombre(), // Usando tu módulo
      username: generar_usuario() // Usando tu módulo
    };
    accountData.fingerprint = fingerprint;

    // 3. Configurar instancia de navegador
    const browserArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      `--user-agent=${fingerprint.userAgent}`,
      `--window-size=${fingerprint.resolution.width},${fingerprint.resolution.height}`,
      `--proxy-server=${proxy.string}`
    ];

    browser = await puppeteer.launch({
      headless: true,
      executablePath: '/usr/bin/chromium-browser',
      args: browserArgs,
      defaultViewport: fingerprint.resolution
    });

    page = await browser.newPage();

    // 4. Autenticación proxy si es necesario
    if (proxy.auth) {
      await page.authenticate({
        username: proxy.auth.username,
        password: proxy.auth.password
      });
    }

    // 5. Configurar idioma y geolocalización
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'es-ES,es;q=0.9,ru-RU;q=0.8,ru;q=0.7,en-US;q=0.6,en;q=0.5'
    });

    // 6. Navegar a Instagram
    await page.goto('https://www.instagram.com/accounts/emailsignup/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // 7. Tomar captura inicial
    accountData.screenshots.push(await takeScreenshot(page, '01_signup_page'));

    // 8. Usar datos de tu módulo nombre_utils.js
    accountData.username = fingerprint.username;
    accountData.password = generatePassword();

    // 9. Rellenar formulario con datos generados
    await humanType(page, 'input[name="emailOrPhone"]', fingerprint.email);
    await randomDelay(1000, 2000);
    
    await humanType(page, 'input[name="fullName"]', fingerprint.fullName);
    await randomDelay(500, 1500);
    
    await humanType(page, 'input[name="username"]', fingerprint.username);
    await randomDelay(1000, 2500);
    
    await humanType(page, 'input[name="password"]', accountData.password);
    await randomDelay(2000, 3000);

    // 10. Simular movimiento humano
    await simulateMouseMovement(page);

    // 11. Hacer clic en Registrarse
    await page.click('button[type="submit"]');
    await randomDelay(3000, 5000);
    accountData.screenshots.push(await takeScreenshot(page, '02_after_signup_click'));

    // 12. Manejar verificación de email
    const emailManager = new EmailManager(proxy);
    const email = await emailManager.createEmail();
    accountData.email = email;
    accountData.emailService = emailManager.currentService;
    logger.info(`📧 Email generado: ${email} (${accountData.emailService})`);

    // 13. Introducir email
    await humanType(page, 'input[name="email_confirmation_code"]', 'waiting');
    await randomDelay(1000, 3000);

    // 14. Obtener código de verificación
    const code = await getVerificationCodeWithRetry(emailManager, 5);
    if (!code) throw new Error('No se recibió el código de verificación');
    
    logger.info(`🔑 Código recibido: ${code}`);

    // 15. Introducir código
    await humanType(page, 'input[name="email_confirmation_code"]', code, true);
    await randomDelay(2000, 4000);
    accountData.screenshots.push(await takeScreenshot(page, '03_after_code_submission'));

    // 16. Verificar creación exitosa
    const success = await verifyAccountCreation(page);
    if (!success) throw new Error('La verificación de la cuenta falló');

    // 17. Marcar cuenta como creada
    accountData.status = 'created';
    logger.info(`✅ Cuenta creada exitosamente: @${fingerprint.username}`);

    // 18. Guardar cookies (PERSISTENCIA)
    accountData.cookiesFile = await saveCookies(page, fingerprint.username);
    logger.info(`🍪 Cookies guardadas en: ${accountData.cookiesFile}`);

    // 19. Guardar datos de la cuenta
    AccountManager.addAccount(accountData);

  } catch (error) {
    accountData.status = 'failed';
    accountData.error = error.message;
    logger.error(`❌ Error creando cuenta: ${error.message}`);
    
    // Tomar captura de error
    if (page) {
      accountData.screenshots.push(await takeScreenshot(page, '99_error_final'));
    }
    
    // Registrar fallo del proxy en el sistema de rotación
    if (accountData.proxy) {
      ProxyRotationSystem.recordFailure(accountData.proxy);
    }
  } finally {
    // 20. Cerrar navegador
    if (browser) await browser.close();
    
    return accountData;
  }
}

// FUNCIÓN PARA GUARDAR COOKIES (PERSISTENCIA)
async function saveCookies(page, username) {
  const cookies = await page.cookies();
  const cookiePath = path.join(COOKIES_DIR, `${username}_cookies.json`);
  
  fs.writeFileSync(cookiePath, JSON.stringify(cookies, null, 2));
  return cookiePath;
}

// FUNCIÓN PARA CARGAR COOKIES (EN OTRO MÓDULO)
export async function loadCookies(page, username) {
  const cookiePath = path.join(COOKIES_DIR, `${username}_cookies.json`);
  
  if (fs.existsSync(cookiePath)) {
    const cookies = JSON.parse(fs.readFileSync(cookiePath, 'utf8'));
    await page.setCookie(...cookies);
    return true;
  }
  return false;
}

// Funciones auxiliares
async function takeScreenshot(page, stepName) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const screenshotPath = path.join(SCREENSHOTS_DIR, `${stepName}_${timestamp}.png`);
  await page.screenshot({ path: screenshotPath });
  return screenshotPath;
}

async function getVerificationCodeWithRetry(emailManager, maxAttempts) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const code = await emailManager.getVerificationCode();
      if (code) return code;
    } catch (error) {
      logger.warn(`Intento ${attempt} fallido: ${error.message}`);
    }
    await randomDelay(15000, 30000); // Esperar 15-30 segundos
  }
  return null;
}

async function verifyAccountCreation(page) {
  try {
    // Verificar si estamos en la página de inicio
    await page.waitForSelector('nav[role="navigation"]', { timeout: 15000 });
    return true;
  } catch (error) {
    // Verificar si hay mensaje de error
    const errorElement = await page.$('p[role="alert"]');
    if (errorElement) {
      const errorText = await page.evaluate(el => el.textContent, errorElement);
      throw new Error(`Error de Instagram: ${errorText}`);
    }
    return false;
  }
}

function generatePassword(length = 12) {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

export default crearCuentaInstagram;
