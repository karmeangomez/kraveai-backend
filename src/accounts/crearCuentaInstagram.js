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
      headless: false,
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

    // Configuración de huella digital completa
    await page.setUserAgent(fingerprint.userAgent);
    await page.setViewport({
      width: fingerprint.screen.width,
      height: fingerprint.screen.height,
      deviceScaleFactor: 1
    });

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-User': '?1'
    });

    // Deshabilitar WebDriver flag
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false
      });
    });

    // Navegación inteligente con manejo de red
    await page.goto('https://www.instagram.com/accounts/emailsignup/', {
      waitUntil: 'networkidle2',
      timeout: 45000
    });

    // Paso 1: Manejo inteligente de cookies
    try {
      const cookieButton = await page.waitForSelector(
        'button:has-text("Allow all cookies"), button:has-text("Accept all"), button:has-text("Allow essential and optional cookies")',
        { timeout: STEP_TIMEOUTS.cookies }
      );
      if (cookieButton) {
        await cookieButton.click();
        console.log('🍪 Cookies aceptadas');
        await page.waitForTimeout(1000); // Pequeña pausa después de acción
      }
    } catch (error) {
      console.log('✅ No se encontró banner de cookies');
    }

    // Paso 2: Cambio a registro por email si es necesario
    try {
      const emailButton = await page.waitForSelector(
        'button:has-text("Use email"), button:has-text("Use email address")',
        { timeout: STEP_TIMEOUTS.emailSwitch }
      );
      if (emailButton) {
        await emailButton.click();
        console.log('📧 Cambiado a registro por correo');
        await page.waitForTimeout(1500); // Pausa para transición
      }
    } catch (error) {
      console.log('✅ Formulario de correo ya visible');
    }

    // Paso 3: Completar formulario con verificación de campos
    await page.waitForSelector('input[name="emailOrPhone"]', { 
      visible: true,
      timeout: STEP_TIMEOUTS.form
    });

    // Rellenar campos con verificación
    await fillFieldSafely(page, 'input[name="emailOrPhone"]', email);
    await fillFieldSafely(page, 'input[name="fullName"]', nombre);
    await fillFieldSafely(page, 'input[name="username"]', username);
    await fillFieldSafely(page, 'input[name="password"]', password);

    console.log(`✅ Cuenta generada: @${username} | ${email}`);

    // Enviar formulario
    const submitButton = await page.waitForSelector('button[type="submit"]');
    await submitButton.click();
    console.log('📝 Formulario enviado');

    // Paso 4: Manejo de fecha de nacimiento
    try {
      await page.waitForSelector('select[title="Month:"]', {
        visible: true,
        timeout: STEP_TIMEOUTS.birthdate
      });

      // Selección aleatoria inteligente
      const month = Math.floor(Math.random() * 12) + 1;
      const day = Math.floor(Math.random() * 28) + 1;
      const year = Math.floor(Math.random() * 25) + 1980; // 1980-2005

      await page.select('select[title="Month:"]', month.toString());
      await page.select('select[title="Day:"]', day.toString());
      await page.select('select[title="Year:"]', year.toString());
      console.log(`🎂 Fecha de nacimiento seleccionada: ${month}/${day}/${year}`);

      // Continuar
      const nextButton = await page.waitForSelector('button:has-text("Next")');
      await nextButton.click();
    } catch (error) {
      console.log('⚠️ No se solicitó fecha de nacimiento');
    }

    // Paso 5: Manejo de verificación de correo
    try {
      await page.waitForSelector('input[name="email_confirmation_code"]', {
        timeout: STEP_TIMEOUTS.verification
      });
      
      console.log('📬 Código de verificación solicitado');
      
      // SIMULACIÓN - IMPLEMENTAR LÓGICA REAL PARA OBTENER CÓDIGO
      // Aquí deberías conectar con tu servicio para obtener el código del email
      const verificationCode = await simulateEmailVerification(email);
      console.log(`🔑 Código obtenido: ${verificationCode}`);
      
      await fillFieldSafely(page, 'input[name="email_confirmation_code"]', verificationCode);
      
      const verifyButton = await page.waitForSelector('button:has-text("Next"), button:has-text("Confirm")');
      await verifyButton.click();
      console.log('✅ Código de verificación enviado');
    } catch (error) {
      console.log('✅ No se solicitó verificación de código');
    }

    // Paso 6: Finalización y confirmación
    try {
      await page.waitForSelector('button:has-text("Done"), svg[aria-label="Instagram"]', {
        timeout: STEP_TIMEOUTS.final
      });
      
      // Si aparece el botón Done, hacer clic
      const doneButton = await page.$('button:has-text("Done")');
      if (doneButton) {
        await doneButton.click();
      }
      
      await page.waitForSelector('svg[aria-label="Instagram"]', { timeout: 30000 });
      console.log('🎉 Cuenta creada exitosamente!');

      // Captura de éxito
      await page.screenshot({ path: `success-${username}.png` });

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
    // Captura de error para diagnóstico
    if (page) {
      const screenshotPath = `error-${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath });
      errorScreenshots.push(screenshotPath);
    }

    console.error(`❌ Error en paso ${retryCount + 1}: ${error.message}`);
    
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

// Función auxiliar para rellenar campos de forma segura
async function fillFieldSafely(page, selector, value) {
  await page.waitForSelector(selector, { visible: true });
  await page.click(selector, { clickCount: 3 }); // Seleccionar todo
  await page.type(selector, value, { delay: 50 });
  
  // Verificar que el valor se ingresó correctamente
  const fieldValue = await page.$eval(selector, el => el.value);
  if (fieldValue !== value) {
    throw new Error(`Error al ingresar valor en ${selector}`);
  }
}

// Simulación de obtención de código de verificación
async function simulateEmailVerification(email) {
  // ESTO ES UN SIMULADOR - IMPLEMENTA TU LÓGICA REAL AQUÍ
  console.log(`⏳ Simulando obtención de código para: ${email}`);
  
  // En un entorno real, aquí conectarías con tu API o servicio de correo
  // Ejemplo real: const response = await axios.get(`https://tu-api.com/email/${email}/code`);
  
  // Generar código aleatorio de 6 dígitos para simulación
  return Math.floor(100000 + Math.random() * 900000).toString();
}
