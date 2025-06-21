import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import axios from 'axios';

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

dotenv.config();
puppeteer.use(StealthPlugin());

const SCREENSHOTS_DIR = path.resolve('screenshots');
const LOGS_DIR = path.resolve('logs');
const COOKIES_DIR = path.resolve('cookies');

[SCREENSHOTS_DIR, LOGS_DIR, COOKIES_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const logger = {
  info: (msg) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`),
  warn: (msg) => console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`),
  error: (msg) => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`),
  debug: (msg) => process.env.DEBUG_MODE === 'true' && console.debug(`[DEBUG] ${new Date().toISOString()} - ${msg}`)
};

async function crearCuentaInstagram(retryCount = 0) {
  const MAX_RETRIES = 2;
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
    cookiesFile: null,
    retryCount
  };

  try {
    // 1. Obtener proxy solo si hay disponibles
    let proxy = null;
    if (ProxyRotationSystem.getActiveProxies().length > 0) {
      proxy = ProxyRotationSystem.getBestProxy();
      accountData.proxy = proxy.string;

      try {
        logger.debug(`🧪 Verificando proxy: ${proxy.string}`);
        await verifyProxyConnection(proxy);
        logger.info(`🛡️ Proxy verificado: ${proxy.string}`);
      } catch (error) {
        logger.error(`❌ Error verificando proxy: ${error.message}`);
        ProxyRotationSystem.recordFailure(proxy.string);
        proxy = null;
      }
    }

    // Si no hay proxy válido, continuar sin proxy
    if (!proxy) {
      logger.warn('⚠️ Continuando sin proxy');
      accountData.proxy = 'none';
    }

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
    const launchOptions = {
      headless: true,
      executablePath: '/usr/bin/chromium-browser',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        `--user-agent=${fingerprint.userAgent}`,
        '--single-process'
      ],
      ignoreHTTPSErrors: true
    };

    // Añadir configuración de proxy si está disponible
    if (proxy) {
      launchOptions.args.push(`--proxy-server=${proxy.string}`);
    }

    browser = await puppeteer.launch(launchOptions);
    page = await browser.newPage();
    
    // Configurar timeouts
    await page.setDefaultNavigationTimeout(60000);
    await page.setDefaultTimeout(40000);
    
    // Optimizar rendimiento
    await page.setRequestInterception(true);
    page.on('request', request => {
      const resourceType = request.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });

    // 5. Autenticación proxy si es necesario
    if (proxy && proxy.auth) {
      await page.authenticate({
        username: proxy.auth.username,
        password: proxy.auth.password
      });
    }

    // 6. Navegar a Instagram con manejo de timeout
    try {
      await page.goto('https://www.instagram.com/accounts/emailsignup/', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
    } catch (error) {
      if (error.name === 'TimeoutError') {
        logger.warn('⚠️ Timeout cargando Instagram, continuando de todos modos');
      } else {
        throw error;
      }
    }

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

    // 9. Manejar verificación de email
    const emailManager = new EmailManager(proxy);
    const email = await emailManager.createEmail();
    accountData.email = email;
    accountData.emailService = emailManager.currentService;
    
    logger.info(`📧 Email generado: ${email} (${accountData.emailService})`);
    
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
    
    // Manejo específico de errores
    if (error.name === 'TimeoutError') {
      accountData.error = 'Timeout en la operación';
      logger.error(`⌛ Timeout: ${error.message}`);
    } else if (error.message.includes('net::ERR_TIMED_OUT')) {
      accountData.error = 'Error de conexión con el proxy';
      logger.error(`🔌 Error de proxy: ${accountData.proxy}`);
    } else {
      accountData.error = error.message;
      logger.error(`❌ Error: ${error.message}`);
    }
    
    if (accountData.proxy && accountData.proxy !== 'none') {
      ProxyRotationSystem.recordFailure(accountData.proxy);
    }
    
    // Lógica de reintento
    if (retryCount < MAX_RETRIES && 
        (error.message.includes('net::ERR_TIMED_OUT') || 
         error.name === 'TimeoutError' ||
         error.message.includes('proxy'))) {
      
      logger.warn(`🔄 Reintento ${retryCount + 1}/${MAX_RETRIES}`);
      await randomDelay(3000, 7000);
      return crearCuentaInstagram(retryCount + 1);
    }
    
    return accountData;
  } finally {
    if (browser) await browser.close();
  }
}

// Funciones auxiliares
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

async function verifyProxyConnection(proxy) {
  try {
    const testUrl = 'http://httpbin.org/ip';
    const response = await axios.get(testUrl, {
      proxy: {
        host: proxy.ip,
        port: proxy.port,
        ...(proxy.auth && { auth: proxy.auth })
      },
      timeout: 5000
    });
    logger.debug(`🧪 Proxy verificado: ${response.data.origin}`);
    return true;
  } catch (error) {
    throw new Error(`Proxy inválido: ${proxy.string} - ${error.message}`);
  }
}

export default crearCuentaInstagram;
