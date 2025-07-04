import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { generarNombreCompleto, generarNombreUsuario } from '../utils/nombre_utils.js';
import { generateAdaptiveFingerprint } from '../fingerprints/generator.js';
import { notifyTelegram } from '../utils/telegram_utils.js';
import { validateProxy } from '../utils/validator.js';
import rotateTorIP from '../proxies/torController.js';

puppeteer.use(StealthPlugin());

const MAX_RETRIES = 3;
const STEP_TIMEOUTS = {
  cookies: 10000,       // Aumentado
  emailSwitch: 10000,   // Aumentado
  form: 60000,          // Aumentado significativamente
  birthdate: 30000,
  verification: 60000,
  final: 30000
};

export async function crearCuentaInstagram(proxy, usarTor = false, retryCount = 0) {
  const fingerprint = generateAdaptiveFingerprint();
  const nombre = generarNombreCompleto();
  const username = generarNombreUsuario();
  const email = `${username.replace(/[^a-zA-Z0-9]/g, '')}@kraveapi.xyz`;
  const password = `Krave${Math.random().toString(36).slice(2, 8)}!`;

  const proxyStr = usarTor ? 'Tor' : `${proxy?.ip}:${proxy?.port}`;
  const proxyProtocol = usarTor ? 'socks5' : (proxy?.type || 'socks5');
  const proxyHost = usarTor ? '127.0.0.1' : proxy?.ip;
  const proxyPort = usarTor ? 9050 : proxy?.port;

  let browser, page;
  const errorScreenshots = [];

  try {
    console.log(`🌐 Usando proxy: ${proxyStr}`);

    // Validación más robusta del proxy
    const esValido = await validateProxy(
      usarTor
        ? {
            ip: '127.0.0.1',
            port: 9050,
            auth: null,
            type: 'socks5',
            country: 'TOR'
          }
        : proxy
    );

    if (!esValido) {
      throw new Error(usarTor ? '⚠️ Tor no responde o está apagado' : `Proxy inválido: ${proxyStr}`);
    }

    // Configuración mejorada de Puppeteer
    const launchOptions = {
      headless: process.env.HEADLESS === 'true',
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: [
        `--proxy-server=${proxyProtocol}://${proxyHost}:${proxyPort}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--lang=en-US,en',
        '--window-size=1200,800'  // Tamaño fijo para mayor consistencia
      ],
      ignoreHTTPSErrors: true,
      defaultViewport: null  // Importante para modo visible
    };

    // Si no está en headless, añadir argumentos para visualización
    if (launchOptions.headless === false) {
      launchOptions.args.push('--start-maximized');
      launchOptions.defaultViewport = {
        width: 1200,
        height: 800,
        deviceScaleFactor: 1
      };
    }

    browser = await puppeteer.launch(launchOptions);
    page = await browser.newPage();

    // Autenticación si es necesario
    if (!usarTor && proxy?.auth?.username && proxy?.auth?.password) {
      await page.authenticate({
        username: proxy.auth.username,
        password: proxy.auth.password
      });
    }

    await page.setUserAgent(fingerprint.userAgent);
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9'
    });

    // Navegación con mayor tolerancia
    await page.goto('https://www.instagram.com/accounts/emailsignup/', {
      waitUntil: 'domcontentloaded',  // Cambiado a más confiable
      timeout: 90000
    });

    // Esperar elemento clave antes de continuar
    await page.waitForSelector('body', { timeout: 30000 });

    // Manejo de cookies - Selector mejorado
    try {
      const cookieButton = await page.waitForSelector(
        'button:contains("Allow all cookies"), button:contains("Accept all"), button:contains("Allow essential")', 
        { timeout: STEP_TIMEOUTS.cookies }
      );
      await cookieButton.click();
      console.log('🍪 Cookies aceptadas');
      await page.waitForTimeout(2000);
    } catch (error) {
      console.log('✅ No se encontró banner de cookies');
    }

    // Cambio a registro por email - Selector mejorado
    try {
      const emailButton = await page.waitForSelector(
        'button:contains("Use email"), button:contains("Use email address"), button:contains("Sign up with email")',
        { timeout: STEP_TIMEOUTS.emailSwitch }
      );
      await emailButton.click();
      console.log('📧 Cambiado a registro por correo');
      await page.waitForTimeout(2500);
    } catch (error) {
      console.log('✅ Formulario de correo ya visible');
    }

    // Completar formulario - Selector más flexible
    try {
      const emailSelector = 'input[name="emailOrPhone"], input[name="email"]';
      await page.waitForSelector(emailSelector, { 
        visible: true,
        timeout: STEP_TIMEOUTS.form
      });
      
      await page.type(emailSelector, email, { delay: 100 });
      await page.type('input[name="fullName"]', nombre, { delay: 100 });
      await page.type('input[name="username"]', username, { delay: 100 });
      await page.type('input[name="password"]', password, { delay: 100 });

      console.log(`✅ Cuenta generada: @${username} | ${email}`);

      // Enviar formulario
      await page.click('button[type="submit"]');
      console.log('📝 Formulario enviado');
      await page.waitForTimeout(5000);
    } catch (error) {
      throw new Error(`No se pudo encontrar el formulario: ${error.message}`);
    }

    // ... resto del código se mantiene igual ...

  } catch (error) {
    // Manejo de errores mejorado
    console.error(`❌ Error en paso ${retryCount + 1}: ${error.message}`);
    
    if (page) {
      const screenshotPath = `error-${Date.now()}.png`;
      await page.screenshot({ 
        path: screenshotPath,
        fullPage: true
      });
      errorScreenshots.push(screenshotPath);
      console.log(`📸 Captura guardada: ${screenshotPath}`);
    }
    
    // ... resto del manejo de errores se mantiene igual ...
  } finally {
    if (browser) await browser.close();
  }
}
