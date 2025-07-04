import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { generarNombreCompleto, generarNombreUsuario } from '../utils/nombre_utils.js';
import { generateAdaptiveFingerprint } from '../fingerprints/generator.js';
import { notifyTelegram } from '../utils/telegram_utils.js';
import { validateProxy } from '../utils/validator.js';

puppeteer.use(StealthPlugin());

const MAX_RETRIES = 3;

export async function crearCuentaInstagram(proxy, retryCount = 0) {
  const fingerprint = generateAdaptiveFingerprint();
  const nombre = generarNombreCompleto();
  const username = generarNombreUsuario();
  const email = `${username.replace(/[^a-zA-Z0-9]/g, '')}@kraveapi.xyz`;
  const password = `Krave${Math.random().toString(36).slice(2, 8)}!`;

  const proxyHost = proxy?.ip;
  const proxyPort = proxy?.port;
  const proxyStr = `${proxyHost}:${proxyPort}`;
  const proxyProtocol = 'http'; // FORZAMOS HTTP para Webshare

  let browser, page;
  const screenshots = [];

  try {
    console.log(`🌐 Usando proxy: ${proxyStr}`);

    const esValido = await validateProxy(proxy);
    if (!esValido) throw new Error(`Proxy inválido: ${proxyStr}`);

    const launchOptions = {
      headless: false, // 🟢 VISIBILIDAD ACTIVADA
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: [
        `--proxy-server=${proxyProtocol}://${proxyHost}:${proxyPort}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--lang=en-US,en',
        '--window-size=1200,800'
      ],
      ignoreHTTPSErrors: true,
      defaultViewport: null
    };

    browser = await puppeteer.launch(launchOptions);
    page = await browser.newPage();

    // ✅ NO usar page.authenticate en Webshare HTTP
    await page.setUserAgent(fingerprint.userAgent);
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

    await page.goto('https://www.instagram.com/accounts/emailsignup/', {
      waitUntil: 'domcontentloaded',
      timeout: 120000
    });

    await page.waitForSelector('body', { timeout: 30000 });
    console.log('✅ Página cargada correctamente');

    // Rellenar formulario básico
    await page.type('input[name="emailOrPhone"]', email, { delay: 100 });
    await page.type('input[name="fullName"]', nombre, { delay: 100 });
    await page.type('input[name="username"]', username, { delay: 100 });
    await page.type('input[name="password"]', password, { delay: 100 });

    const btn = await page.$('button[type="submit"]');
    if (btn) await btn.click();

    console.log(`✅ Cuenta generada: @${username} | ${email}`);

    // Espera para revisión visual
    await new Promise(resolve => setTimeout(resolve, 10000));

    return {
      usuario: username,
      email,
      password,
      proxy: proxyStr,
      status: 'success'
    };

  } catch (err) {
    console.error(`❌ Error en paso ${retryCount + 1}: ${err.message}`);

    if (page && !page.isClosed()) {
      const path = `error-${Date.now()}.png`;
      await page.screenshot({ path, fullPage: true });
      screenshots.push(path);
    }

    if (retryCount < MAX_RETRIES) {
      console.log(`🔄 Reintentando (${retryCount + 1}/${MAX_RETRIES})...`);
      return crearCuentaInstagram(proxy, retryCount + 1);
    }

    await notifyTelegram(`❌ Fallo en creación de cuenta: ${err.message}`);
    return {
      status: 'failed',
      error: err.message,
      screenshots,
      accountDetails: { username, email, password }
    };
  } finally {
    // No cerrar navegador, queremos visibilidad
  }
}
