import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import winston from 'winston';
import { generarNombreCompleto, generarNombreUsuario } from '../utils/nombre_utils.js';
import { generateAdaptiveFingerprint } from '../fingerprints/generator.js';
import { notifyTelegram } from '../utils/telegram_utils.js';
import { validateProxy } from '../utils/validator.js';

puppeteer.use(StealthPlugin());

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.simple()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.Console()
  ]
]);

const MAX_REINTENTOS = 3;

export async function crearCuentaInstagram(proxy, reintento = 0) {
  const fingerprint = generateAdaptiveFingerprint();
  const nombre = generarNombreCompleto();
  const username = generarNombreUsuario();
  const email = `${username}@kraveapi.xyz`;
  const password = `Krave${Math.random().toString(36).slice(2, 8)}!`;
  const proxyStr = `${proxy.ip}:${proxy.port}`;
  const proxyUrl = `http://${proxy.auth.username}:${proxy.auth.password}@${proxy.ip}:${proxy.port}`;

  let browser;
  let page;

  try {
    logger.info(`🌐 Validando proxy: ${proxyStr}`);
    const esValido = await validateProxy(proxy);
    if (!esValido) throw new Error(`Proxy inválido: ${proxyStr}`);

    logger.info(`🚀 Lanzando navegador con proxy: ${proxyUrl}`);

    browser = await puppeteer.launch({
      headless: false,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
      args: [`--proxy-server=${proxyUrl}`, '--no-sandbox'],
      defaultViewport: { width: 1280, height: 720 },
    });

    page = await browser.newPage();
    await page.setUserAgent(fingerprint.userAgent);

    await page.goto('https://www.instagram.com/accounts/emailsignup/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await page.waitForSelector('input[name="emailOrPhone"]', { timeout: 10000 });
    await page.type('input[name="emailOrPhone"]', email, { delay: 60 });
    await page.type('input[name="fullName"]', nombre, { delay: 60 });
    await page.type('input[name="username"]', username, { delay: 60 });
    await page.type('input[name="password"]', password, { delay: 60 });

    await page.waitForTimeout(1500);
    await page.click('button[type="submit"]');

    await page.waitForTimeout(5000);

    // Validación visual
    const success = await page.evaluate(() => {
      return !document.body.innerText.includes('Try Again') &&
             !document.body.innerText.includes('challenge') &&
             document.querySelector('input[name="emailOrPhone"]') === null;
    });

    if (success) {
      logger.info(`✅ Cuenta creada: @${username}`);
      return {
        status: 'success',
        usuario: username,
        email,
        password,
        proxy: proxyStr
      };
    } else {
      throw new Error('Instagram bloqueó el registro o captcha requerido');
    }
  } catch (error) {
    logger.error(`❌ Error: ${error.message}`);

    if (page && !page.isClosed()) {
      try {
        const path = `error-${Date.now()}.png`;
        await page.screenshot({ path });
        logger.warn(`📸 Screenshot guardado: ${path}`);
      } catch {}
    }

    if (reintento < MAX_REINTENTOS) {
      logger.info(`🔁 Reintentando creación (${reintento + 1}/${MAX_REINTENTOS})`);
      return crearCuentaInstagram(proxy, reintento + 1);
    }

    return { status: 'failed', error: error.message };
  } finally {
    if (browser) await browser.close();
  }
}