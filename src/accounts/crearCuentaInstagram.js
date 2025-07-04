import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { generarNombreCompleto, generarNombreUsuario } from '../utils/nombre_utils.js';
import { generateAdaptiveFingerprint } from '../fingerprints/generator.js';
import { notifyTelegram } from '../utils/telegram_utils.js';
import { validateProxy } from '../utils/validator.js';

puppeteer.use(StealthPlugin());

const MAX_RETRIES = 3;
const STEP_TIMEOUTS = {
  cookies: 20000,  // 20 segundos
  emailSwitch: 15000,
  form: 60000,
  birthdate: 30000,
  verification: 60000,
  final: 30000
};

export async function crearCuentaInstagram(proxy, retryCount = 0) {
  const fingerprint = generateAdaptiveFingerprint();
  const nombre = generarNombreCompleto();
  const username = generarNombreUsuario();
  const email = `${username.replace(/[^a-zA-Z0-9]/g, '')}@kraveapi.xyz`;
  const password = `Krave${Math.random().toString(36).slice(2, 8)}!`;

  const proxyStr = `${proxy?.ip}:${proxy?.port}`;
  const proxyProtocol = proxy?.type || 'http';
  const proxyHost = proxy?.ip;
  const proxyPort = proxy?.port;

  let browser, page;
  const errorScreenshots = [];

  try {
    console.log(`🌐 Usando proxy: ${proxyStr}`);

    // Validación en tiempo real del proxy
    const esValido = await validateProxy(proxy);
    if (!esValido) {
      throw new Error(`Proxy inválido: ${proxyStr}`);
    }

    // CONFIGURACIÓN PARA MODO VISIBLE
    const launchOptions = {
      headless: process.env.HEADLESS === 'true',  // Configurable por ENV
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: [
        `--proxy-server=${proxyProtocol}://${proxyHost}:${proxyPort}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--lang=en-US,en',
        '--window-size=1200,800',
        '--start-maximized'
        // Comentado para mejor rendimiento en Raspberry Pi:
        // '--auto-open-devtools-for-tabs'
      ],
      ignoreHTTPSErrors: true,
      defaultViewport: null
    };

    browser = await puppeteer.launch(launchOptions);
    page = await browser.newPage();

    // Autenticación si es necesario
    if (proxy?.auth?.username && proxy?.auth?.password) {
      await page.authenticate({
        username: proxy.auth.username,
        password: proxy.auth.password
      });
    }

    await page.setUserAgent(fingerprint.userAgent);
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9'
    });

    // Navegación inteligente con reintentos
    await page.goto('https://www.instagram.com/accounts/emailsignup/', {
      waitUntil: 'domcontentloaded',
      timeout: 120000
    });

    // Esperar a que cargue el cuerpo de la página
    await page.waitForSelector('body', { timeout: 30000 });

    // DETECCIÓN ULTRA-INTELIGENTE DE COOKIES
    try {
      const cookieSelectors = [
        'button:has-text("Allow")',
        'button:has-text("Accept")',
        'button:has-text("Cookies")',
        'button:has-text("Got it")',
        'div[class*="cookie"] button',
        'button[class*="cookie"]',
        'button[title*="cookie"]',
        'button[aria-label*="cookie"]'
      ];

      const cookieButton = await page.waitForSelector(
        cookieSelectors.join(', '),
        { timeout: STEP_TIMEOUTS.cookies }
      );
      
      if (cookieButton) {
        await cookieButton.click();
        console.log('🍪 Cookies aceptadas');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Verificar si el banner desapareció
        const isCookieBannerGone = await page.evaluate((selectors) => {
          return !document.querySelector(selectors.join(', '));
        }, cookieSelectors);
        
        if (!isCookieBannerGone) {
          throw new Error('El banner de cookies no desapareció después de hacer clic');
        }
      }
    } catch (error) {
      console.log('✅ No se encontró banner de cookies o no fue necesario');
      // Captura de pantalla para depuración
      await page.screenshot({ path: `cookie-debug-${Date.now()}.png`, fullPage: true });
    }

    // CAMBIO A REGISTRO POR EMAIL (Detección mejorada)
    try {
      const emailButton = await page.waitForSelector(
        'button:has-text("email"), a:has-text("email"), button[aria-label*="email"], a[aria-label*="email"], button:has-text("Use email")',
        { timeout: STEP_TIMEOUTS.emailSwitch }
      );
      
      if (emailButton) {
        await emailButton.click();
        console.log('📧 Cambiado a registro por correo');
        await new Promise(resolve => setTimeout(resolve, 2500));
      }
    } catch (error) {
      console.log('✅ Formulario de correo ya visible');
    }

    // FORMULARIO INTELIGENTE (con múltiples estrategias)
    try {
      // Estrategia 1: Esperar por formulario
      await page.waitForSelector('form', { 
        visible: true,
        timeout: STEP_TIMEOUTS.form
      });

      // Estrategia 2: Detección de campos por múltiples atributos
      const fieldSelectors = {
        email: [
          'input[aria-label*="Email"]',
          'input[aria-label*="Phone"]',
          'input[name*="email"]',
          'input[name*="phone"]',
          'input[type="email"]',
          'input[type="tel"]',
          'input[placeholder*="Email"]',
          'input[placeholder*="Phone"]'
        ],
        fullName: [
          'input[aria-label*="Full Name"]',
          'input[name="fullName"]',
          'input[aria-label*="Name"]'
        ],
        username: [
          'input[aria-label*="Username"]',
          'input[name="username"]'
        ],
        password: [
          'input[aria-label*="Password"]',
          'input[name="password"]',
          'input[type="password"]'
        ]
      };

      const emailField = await findElementBySelectors(page, fieldSelectors.email);
      await emailField.type(email, { delay: 100 });
      await new Promise(resolve => setTimeout(resolve, 500));

      const fullNameField = await findElementBySelectors(page, fieldSelectors.fullName);
      await fullNameField.type(nombre, { delay: 100 });
      await new Promise(resolve => setTimeout(resolve, 500));

      const usernameField = await findElementBySelectors(page, fieldSelectors.username);
      await usernameField.type(username, { delay: 100 });
      await new Promise(resolve => setTimeout(resolve, 500));

      const passwordField = await findElementBySelectors(page, fieldSelectors.password);
      await passwordField.type(password, { delay: 100 });
      await new Promise(resolve => setTimeout(resolve, 500));

      console.log(`✅ Cuenta generada: @${username} | ${email}`);

      // Enviar formulario con detección inteligente
      const submitSelectors = [
        'button[type="submit"]',
        'button:has-text("Sign up")',
        'button:has-text("Next")',
        'button[aria-label*="Next"]'
      ];
      
      const submitButton = await findElementBySelectors(page, submitSelectors);
      await submitButton.click();
      console.log('📝 Formulario enviado');
      await new Promise(resolve => setTimeout(resolve, 5000));
    } catch (error) {
      // Captura de pantalla detallada para diagnóstico
      await page.screenshot({ path: `form-error-${Date.now()}.png`, fullPage: true });
      throw new Error(`No se pudo completar el formulario: ${error.message}`);
    }

    // MANEJO INTELIGENTE DE FECHA DE NACIMIENTO
    try {
      const monthSelector = await findElementBySelectors(page, [
        'select[title="Month:"]',
        'select[aria-label*="Month"]',
        'select[name*="month"]'
      ]);
      
      const month = Math.floor(Math.random() * 12) + 1;
      await monthSelector.select(month.toString());
      await new Promise(resolve => setTimeout(resolve, 500));

      const daySelector = await findElementBySelectors(page, [
        'select[title="Day:"]',
        'select[aria-label*="Day"]',
        'select[name*="day"]'
      ]);
      await daySelector.select((Math.floor(Math.random() * 28) + 1).toString());
      await new Promise(resolve => setTimeout(resolve, 500));

      const yearSelector = await findElementBySelectors(page, [
        'select[title="Year:"]',
        'select[aria-label*="Year"]',
        'select[name*="year"]'
      ]);
      await yearSelector.select((Math.floor(Math.random() * 20) + 1980).toString());
      await new Promise(resolve => setTimeout(resolve, 500));

      const nextButton = await findElementBySelectors(page, [
        'button:has-text("Next")',
        'button:has-text("Continue")',
        'button[aria-label*="Next"]'
      ]);
      await nextButton.click();
      console.log('🎂 Fecha de nacimiento seleccionada');
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (error) {
      console.log('⚠️ No se solicitó fecha de nacimiento');
    }

    // VERIFICACIÓN FINAL INTELIGENTE
    try {
      await page.waitForSelector('svg[aria-label="Instagram"], div[role="main"]', {
        timeout: STEP_TIMEOUTS.final
      });
      console.log('🎉 ¡Registro exitoso!');
      
      // Esperar para ver el resultado
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
      await page.screenshot({ path: screenshotPath, fullPage: true });
      errorScreenshots.push(screenshotPath);
      console.log(`📸 Captura guardada: ${screenshotPath}`);
    }
    
    if (retryCount < MAX_RETRIES) {
      console.log(`🔄 Reintentando (${retryCount + 1}/${MAX_RETRIES})...`);
      return crearCuentaInstagram(proxy, retryCount + 1);
    }
    
    await notifyTelegram(`❌ Fallo en creación de cuenta: ${error.message}`);
    return {
      status: 'failed',
      error: error.message,
      screenshots: errorScreenshots,
      accountDetails: { username, email, password }
    };
  } finally {
    // Mantener el navegador abierto para depuración
    // if (browser) await browser.close();
  }
}

// Función auxiliar ultra-inteligente para encontrar elementos
async function findElementBySelectors(page, selectors) {
  for (const selector of selectors) {
    try {
      const element = await page.waitForSelector(selector, { timeout: 5000 });
      if (element) return element;
    } catch (e) {
      // Continuar con el siguiente selector
    }
  }
  throw new Error(`No se encontró elemento con selectores: ${selectors.join(', ')}`);
}
