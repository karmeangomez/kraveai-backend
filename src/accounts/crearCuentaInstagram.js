import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { generarNombreCompleto, generarNombreUsuario } from '../utils/nombre_utils.js';
import { generateAdaptiveFingerprint } from '../fingerprints/generator.js';
import { notifyTelegram } from '../utils/telegram_utils.js';
import { validateProxy } from '../utils/validator.js';
import rotateTorIP from '../proxies/torController.js';

puppeteer.use(StealthPlugin());

// Configuración inteligente de reintentos
const MAX_RETRIES = 3;
const STEP_TIMEOUTS = {
  cookies: 5000,
  emailSwitch: 5000,
  form: 30000,
  birthdate: 30000,
  verification: 60000,
  final: 30000
};

export default async function crearCuentaInstagram(proxy, usarTor = false, retryCount = 0) {
  const fingerprint = generateAdaptiveFingerprint();
  const nombre = generarNombreCompleto();
  const username = generarNombreUsuario();
  const email = `${username.replace(/[^a-zA-Z0-9]/g, '')}@kraveapi.xyz`;
  const password = `Krave${Math.random().toString(36).slice(2, 8)}!`;

  const proxyStr = usarTor ? 'Tor' : `${proxy?.ip}:${proxy?.port}`;
  const proxyProtocol = usarTor ? 'socks5' : proxy?.type || 'socks5';
  const proxyHost = usarTor ? '127.0.0.1' : proxy?.ip;
  const proxyPort = usarTor ? 9050 : proxy?.port;

  let browser, page;
  const errorScreenshots = [];

  try {
    console.log(`🌐 Usando proxy: ${proxyStr}`);

    // Validación inteligente de proxy
    const esValido = await validateProxy(
      usarTor
        ? {
            ip: '127.0.0.1',
            port: 9050,
            auth: null,
            type: 'socks5'
          }
        : proxy
    );

    if (!esValido) {
      throw new Error(usarTor ? '⚠️ Tor no responde o está apagado' : `Proxy inválido: ${proxyStr}`);
    }

    // Configuración avanzada del navegador
    browser = await puppeteer.launch({
      headless: process.env.HEADLESS === 'true',
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: [
        `--proxy-server=${proxyProtocol}://${proxyHost}:${proxyPort}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--lang=en-US,en'
      ],
      ignoreHTTPSErrors: true,
      defaultViewport: null
    });

    page = await browser.newPage();

    // Configuración de autenticación si es necesario
    if (!usarTor && proxy?.auth?.username && proxy?.auth?.password) {
      await page.authenticate({
        username: proxy.auth.username,
        password: proxy.auth.password
      });
    }

    // ... (resto del código para configuración de navegador y registro)

    return {
      usuario: username,
      email,
      password,
      proxy: proxyStr,
      status: 'success'
    };

  } catch (error) {
    console.error(`❌ Error en paso ${retryCount + 1}: ${error.message}`);
    
    // Captura de error para diagnóstico
    if (page) {
      const screenshotPath = `error-${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath });
      errorScreenshots.push(screenshotPath);
    }
    
    // Manejo específico del error "Cuenta inválida"
    if (error.message.includes('Cuenta inválida') && usarTor) {
      console.log('🔄 Rotando IP de Tor debido a error de cuenta inválida...');
      await rotateTorIP();
      return crearCuentaInstagram(null, true, 0);
    }
    
    // Lógica de reintento inteligente
    if (retryCount < MAX_RETRIES) {
      console.log(`🔄 Reintentando (${retryCount + 1}/${MAX_RETRIES})...`);
      return crearCuentaInstagram(proxy, usarTor, retryCount + 1);
    }
    
    // Fallback a Tor si es posible
    if (!usarTor) {
      console.log('🔁 Cambiando a Tor como fallback...');
      await rotateTorIP();
      return crearCuentaInstagram(null, true, 0);
    } else {
      await notifyTelegram(`❌ Fallo en creación de cuenta: ${error.message}`);
      return {
        status: 'failed',
        error: error.message,
        screenshots: errorScreenshots,
        accountDetails: { username, email, password }
      };
    }
  } finally {
    if (browser) await browser.close();
  }
}

// ... (funciones auxiliares: fillFieldSafely, handleCookies, etc.)
