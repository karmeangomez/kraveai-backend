import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { generarNombreCompleto, generarNombreUsuario } from '../utils/nombre_utils.js';
import { generateAdaptiveFingerprint } from '../fingerprints/generator.js';
import { notifyTelegram } from '../utils/telegram_utils.js';
import { validateProxy } from '../utils/validator.js';

puppeteer.use(StealthPlugin());

const MAX_RETRIES = 3;
const STEP_TIMEOUTS = {
  cookies: 20000,
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
  const proxyStr = `${proxy.ip}:${proxy.port}`;
  let browser, page;
  const errorScreenshots = [];

  try {
    console.log(`🌐 Usando proxy: ${proxyStr}`);

    const esValido = await validateProxy(proxy);
    if (!esValido) throw new Error(`Proxy inválido: ${proxyStr}`);

    const proxyUrl = proxy.auth
      ? `http://${proxy.auth.username}:${proxy.auth.password}@${proxy.ip}:${proxy.port}`
      : `http://${proxy.ip}:${proxy.port}`;

    const launchOptions = {
      headless: false,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
      args: [
        `--proxy-server=${proxyUrl}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        '--lang=en-US,en;q=0.9',
        '--window-size=1280,720',
        '--no-zygote',
        '--disable-accelerated-2d-canvas',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ],
      ignoreHTTPSErrors: true,
      defaultViewport: { width: 1280, height: 720 },
      slowMo: 50
    };

    browser = await puppeteer.launch(launchOptions);
    page = await browser.newPage();

    await page.setUserAgent(fingerprint.userAgent);
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'DNT': '1'
    });

    await page.emulateMediaFeatures([
      { name: 'prefers-color-scheme', value: 'light' },
      { name: 'prefers-reduced-motion', value: 'no-preference' }
    ]);

    await page.goto('https://www.instagram.com/accounts/emailsignup/', {
      waitUntil: 'networkidle2',
      timeout: 120000
    });

    await page.waitForSelector('body', { timeout: 30000 });

    // Cookies
    try {
      const cookieSelectors = [
        'button:has-text("Allow")', 'button:has-text("Accept")',
        'div[class*="cookie"] button', 'button[class*="cookie"]',
        'button[title*="cookie"]', 'button[aria-label*="cookie"]'
      ];
      const cookieButton = await page.waitForSelector(cookieSelectors.join(', '), { timeout: STEP_TIMEOUTS.cookies });
      if (cookieButton) {
        await cookieButton.click();
        console.log('🍪 Cookies aceptadas');
        await page.waitForTimeout(3000);
      }
    } catch {
      console.log('✅ No se encontró banner de cookies');
    }

    // Cambiar a email
    try {
      const emailButton = await page.waitForSelector(
        'button:has-text("Use email"), a:has-text("Use email")',
        { timeout: STEP_TIMEOUTS.emailSwitch }
      );
      if (emailButton) {
        await emailButton.click();
        console.log('📧 Cambiado a email');
        await page.waitForTimeout(2500);
      }
    } catch {
      console.log('✅ Ya en formulario de email');
    }

    // Formulario
    try {
      await page.waitForSelector('form', { visible: true, timeout: STEP_TIMEOUTS.form });

      const fieldSelectors = {
        email: ['input[type="email"]', 'input[name*="email"]'],
        fullName: ['input[name="fullName"]'],
        username: ['input[name="username"]'],
        password: ['input[name="password"]', 'input[type="password"]']
      };

      const emailElement = await findElementBySelectors(page, fieldSelectors.email);
      await emailElement.type(email, { delay: Math.random() * 50 + 50 });

      const fullNameElement = await findElementBySelectors(page, fieldSelectors.fullName);
      await fullNameElement.type(nombre, { delay: Math.random() * 50 + 50 });

      const usernameElement = await findElementBySelectors(page, fieldSelectors.username);
      await usernameElement.type(username, { delay: Math.random() * 50 + 50 });

      const passwordElement = await findElementBySelectors(page, fieldSelectors.password);
      await passwordElement.type(password, { delay: Math.random() * 50 + 50 });

      const submitSelectors = ['button[type="submit"]', 'button:has-text("Sign up")'];
      await (await findElementBySelectors(page, submitSelectors)).click();

      console.log(`📝 Formulario enviado para @${username}`);
      await page.waitForTimeout(5000);
    } catch (error) {
      throw new Error(`No se pudo completar el formulario: ${error.message}`);
    }

    // Fecha de nacimiento
    try {
      const month = Math.floor(Math.random() * 12) + 1;
      const day = Math.floor(Math.random() * 28) + 1;
      const year = Math.floor(Math.random() * 20) + 1980;

      await (await findElementBySelectors(page, ['select[title="Month:"]'])).select(month.toString());
      await (await findElementBySelectors(page, ['select[title="Day:"]'])).select(day.toString());
      await (await findElementBySelectors(page, ['select[title="Year:"]'])).select(year.toString());

      const nextButton = await findElementBySelectors(page, ['button:has-text("Next")']);
      await nextButton.click();
      console.log('🎂 Fecha de nacimiento seleccionada');
      await page.waitForTimeout(3000);
    } catch {
      console.log('⚠️ No se solicitó fecha de nacimiento');
    }

    await page.waitForSelector('svg[aria-label="Instagram"], div[role="main"]', {
      timeout: STEP_TIMEOUTS.final
    });

    console.log('🎉 ¡Cuenta creada!');
    await page.waitForTimeout(10000);

    return {
      usuario: username,
      email,
      password,
      proxy: proxyStr,
      status: 'success'
    };
  } catch (error) {
    console.error(`❌ Error en paso ${retryCount + 1}: ${error.message}`);
    if (page && !page.isClosed()) {
      const screenshotPath = `error-${Date.now()}.png`;
      try {
        await page.screenshot({ path: screenshotPath, fullPage: true });
        errorScreenshots.push(screenshotPath);
        console.log(`📸 Captura guardada: ${screenshotPath}`);
      } catch (screenshotError) {
        console.error(`⚠️ Error al tomar captura: ${screenshotError.message}`);
      }
    }
    if (retryCount < MAX_RETRIES) {
      console.log(`🔄 Reintentando (${retryCount + 1}/${MAX_RETRIES})...`);
      return crearCuentaInstagram(proxy, retryCount + 1);
    }
    await notifyTelegram(`❌ Fallo creando cuenta: ${error.message}`);
    return {
      status: 'failed',
      error: error.message,
      screenshots: errorScreenshots,
      accountDetails: { username, email, password }
    };
  } finally {
    if (browser) await browser.close();
  }
}

async function findElementBySelectors(page, selectors) {
  for (const selector of selectors) {
    try {
      const el = await page.waitForSelector(selector, { timeout: 5000 });
      if (el) return el;
    } catch {}
  }
  throw new Error(`No se encontró ningún selector válido: ${selectors.join(', ')}`);
}
