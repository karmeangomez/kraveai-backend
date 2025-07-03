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
  const proxyProtocol = usarTor ? 'socks5' : (proxy?.type || 'socks5');
  const proxyHost = usarTor ? '127.0.0.1' : proxy?.ip;
  const proxyPort = usarTor ? 9050 : proxy?.port;

  let browser, page;
  const errorScreenshots = [];

  try {
    console.log(`🌐 Usando proxy: ${proxyStr}`);

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

    browser = await puppeteer.launch({
      headless: process.env.HEADLESS === 'true',
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: [
        `--proxy-server=${proxyProtocol}://${proxyHost}:${proxyPort}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--lang=en-US,en'
      ],
      ignoreHTTPSErrors: true
    });

    page = await browser.newPage();

    if (!usarTor && proxy?.auth?.username && proxy?.auth?.password) {
      await page.authenticate({
        username: proxy.auth.username,
        password: proxy.auth.password
      });
    }

    await page.setUserAgent(fingerprint.userAgent);
    await page.setViewport({
      width: fingerprint.screen.width,
      height: fingerprint.screen.height,
      deviceScaleFactor: 1
    });

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9'
    });

    await page.goto('https://www.instagram.com/accounts/emailsignup/', {
      waitUntil: 'networkidle2',
      timeout: 45000
    });

    // Manejo de cookies
    try {
      const cookieButton = await page.waitForSelector(
        'button:has-text("Allow all cookies"), button:has-text("Accept all")', 
        { timeout: STEP_TIMEOUTS.cookies }
      );
      await cookieButton.click();
      console.log('🍪 Cookies aceptadas');
      await page.waitForTimeout(1000);
    } catch (error) {
      console.log('✅ No se encontró banner de cookies');
    }

    // Cambio a registro por email
    try {
      const emailButton = await page.waitForSelector(
        'button:has-text("Use email"), button:has-text("Use email address")',
        { timeout: STEP_TIMEOUTS.emailSwitch }
      );
      await emailButton.click();
      console.log('📧 Cambiado a registro por correo');
      await page.waitForTimeout(1500);
    } catch (error) {
      console.log('✅ Formulario de correo ya visible');
    }

    // Completar formulario
    await page.waitForSelector('input[name="emailOrPhone"]', { 
      visible: true,
      timeout: STEP_TIMEOUTS.form
    });
    
    await page.type('input[name="emailOrPhone"]', email, { delay: 100 });
    await page.type('input[name="fullName"]', nombre, { delay: 100 });
    await page.type('input[name="username"]', username, { delay: 100 });
    await page.type('input[name="password"]', password, { delay: 100 });

    console.log(`✅ Cuenta generada: @${username} | ${email}`);

    // Enviar formulario
    await page.click('button[type="submit"]');
    console.log('📝 Formulario enviado');
    await page.waitForTimeout(3000);

    // Manejo de fecha de nacimiento
    try {
      await page.waitForSelector('select[title="Month:"]', {
        visible: true,
        timeout: STEP_TIMEOUTS.birthdate
      });

      const month = Math.floor(Math.random() * 12) + 1;
      const day = Math.floor(Math.random() * 28) + 1;
      const year = Math.floor(Math.random() * 20) + 1980;

      await page.select('select[title="Month:"]', month.toString());
      await page.select('select[title="Day:"]', day.toString());
      await page.select('select[title="Year:"]', year.toString());
      
      await page.click('button:has-text("Next")');
      console.log(`🎂 Fecha seleccionada: ${month}/${day}/${year}`);
    } catch (error) {
      console.log('⚠️ No se solicitó fecha de nacimiento');
    }

    // Verificación final
    try {
      await page.waitForSelector('svg[aria-label="Instagram"]', {
        timeout: STEP_TIMEOUTS.final
      });
      console.log('🎉 ¡Registro exitoso!');
      
      return {
        usuario: username,
        email,
        password,
        proxy: proxyStr,
        status: 'success'
      };
    } catch (error) {
      throw new Error('No se pudo confirmar la creación de la cuenta');
    }

  } catch (error) {
    console.error(`❌ Error en paso ${retryCount + 1}: ${error.message}`);
    
    if (page) {
      const screenshotPath = `error-${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath });
      errorScreenshots.push(screenshotPath);
    }
    
    if (error.message.includes('Cuenta inválida') && usarTor) {
      console.log('🔄 Rotando IP de Tor debido a error de cuenta...');
      await rotateTorIP();
      return crearCuentaInstagram(null, true, 0);
    }
    
    if (retryCount < MAX_RETRIES) {
      console.log(`🔄 Reintentando (${retryCount + 1}/${MAX_RETRIES})...`);
      return crearCuentaInstagram(proxy, usarTor, retryCount + 1);
    }
    
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
