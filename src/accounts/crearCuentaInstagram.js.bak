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
  cookies: 10000,
  emailSwitch: 10000,
  form: 60000,
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

    // Validación del proxy
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

    // CONFIGURACIÓN COMPLETA PARA MODO VISIBLE
    const launchOptions = {
      headless: false,  // MODO VISIBLE ACTIVADO
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: [
        `--proxy-server=${proxyProtocol}://${proxyHost}:${proxyPort}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--lang=en-US,en',
        '--window-size=1200,800',
        '--start-maximized',       // Ventana maximizada
        '--auto-open-devtools-for-tabs'  // Abrir herramientas de desarrollo
      ],
      ignoreHTTPSErrors: true,
      defaultViewport: null  // Deshabilitar viewport predeterminado
    };

    browser = await puppeteer.launch(launchOptions);
    page = await browser.newPage();

    // Configuración de tamaño de ventana
    await page.setViewport({
      width: 1200,
      height: 800,
      deviceScaleFactor: 1
    });

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

    // Navegación con mayor tiempo de espera
    await page.goto('https://www.instagram.com/accounts/emailsignup/', {
      waitUntil: 'domcontentloaded',  // Más confiable que networkidle
      timeout: 120000  // 120 segundos
    });

    // Esperar a que cargue el cuerpo de la página
    await page.waitForSelector('body', { timeout: 30000 });

    // Manejo de cookies - Selector mejorado
    try {
      const cookieButton = await page.waitForSelector(
        'button:has-text("Allow all cookies"), button:has-text("Accept all"), button:has-text("Allow essential")', 
        { timeout: STEP_TIMEOUTS.cookies }
      );
      await cookieButton.click();
      console.log('🍪 Cookies aceptadas');
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.log('✅ No se encontró banner de cookies');
    }

    // Cambio a registro por email - Selector mejorado
    try {
      const emailButton = await page.waitForSelector(
        'button:has-text("Use email"), button:has-text("Use email address"), button:has-text("Sign up with email")',
        { timeout: STEP_TIMEOUTS.emailSwitch }
      );
      await emailButton.click();
      console.log('📧 Cambiado a registro por correo');
      await new Promise(resolve => setTimeout(resolve, 2500));
    } catch (error) {
      console.log('✅ Formulario de correo ya visible');
    }

    // SOLUCIÓN: Nuevos selectores para el formulario actualizado de Instagram
    try {
      // Esperar a que aparezca el formulario
      await page.waitForSelector('form', { 
        visible: true,
        timeout: STEP_TIMEOUTS.form
      });
      
      // Identificar campos por sus nuevas propiedades
      const emailField = await page.waitForSelector(
        'input[aria-label*="Email"], input[aria-label*="Phone"], input[name*="email"], input[name*="phone"]',
        { timeout: 10000 }
      );
      
      const fullNameField = await page.waitForSelector(
        'input[aria-label*="Full Name"], input[name="fullName"]',
        { timeout: 5000 }
      );
      
      const usernameField = await page.waitForSelector(
        'input[aria-label*="Username"], input[name="username"]',
        { timeout: 5000 }
      );
      
      const passwordField = await page.waitForSelector(
        'input[aria-label*="Password"], input[name="password"]',
        { timeout: 5000 }
      );
      
      // Rellenar formulario lentamente
      await emailField.type(email, { delay: 100 });
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await fullNameField.type(nombre, { delay: 100 });
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await usernameField.type(username, { delay: 100 });
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await passwordField.type(password, { delay: 100 });
      await new Promise(resolve => setTimeout(resolve, 500));

      console.log(`✅ Cuenta generada: @${username} | ${email}`);

      // Enviar formulario - Selector mejorado
      const submitButton = await page.waitForSelector(
        'button[type="submit"], button:has-text("Sign up"), button:has-text("Next")',
        { timeout: 5000 }
      );
      await submitButton.click();
      console.log('📝 Formulario enviado');
      await new Promise(resolve => setTimeout(resolve, 5000));
    } catch (error) {
      throw new Error(`No se pudo encontrar el formulario: ${error.message}`);
    }

    // Manejo de fecha de nacimiento
    try {
      const monthSelector = await page.waitForSelector(
        'select[title="Month:"], select[aria-label*="Month"]',
        { timeout: STEP_TIMEOUTS.birthdate }
      );

      const month = Math.floor(Math.random() * 12) + 1;
      const day = Math.floor(Math.random() * 28) + 1;
      const year = Math.floor(Math.random() * 20) + 1980;

      await monthSelector.select(month.toString());
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const daySelector = await page.waitForSelector(
        'select[title="Day:"], select[aria-label*="Day"]',
        { timeout: 3000 }
      );
      await daySelector.select(day.toString());
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const yearSelector = await page.waitForSelector(
        'select[title="Year:"], select[aria-label*="Year"]',
        { timeout: 3000 }
      );
      await yearSelector.select(year.toString());
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const nextButton = await page.waitForSelector(
        'button:has-text("Next"), button:has-text("Continue")',
        { timeout: 3000 }
      );
      await nextButton.click();
      console.log(`🎂 Fecha seleccionada: ${month}/${day}/${year}`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (error) {
      console.log('⚠️ No se solicitó fecha de nacimiento');
    }

    // Verificación final
    try {
      await page.waitForSelector('svg[aria-label="Instagram"], div[role="main"]', {
        timeout: STEP_TIMEOUTS.final
      });
      console.log('🎉 ¡Registro exitoso!');
      
      // Esperar 15 segundos para ver el resultado
      await new Promise(resolve => setTimeout(resolve, 15000));
      
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
      await page.screenshot({ 
        path: screenshotPath,
        fullPage: true
      });
      errorScreenshots.push(screenshotPath);
      console.log(`📸 Captura guardada: ${screenshotPath}`);
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
    // NO cerrar el navegador para poder ver el resultado
    // if (browser) await browser.close();
  }
}
