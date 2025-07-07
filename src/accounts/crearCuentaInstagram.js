import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { generarNombreCompleto, generarNombreUsuario } from '../utils/nombre_utils.js';
import { validateProxy } from '../utils/validator.js';
import { notifyTelegram } from '../utils/telegram_utils.js';
import { generateAdaptiveFingerprint } from '../fingerprints/generator.js';
import fs from 'fs';
import path from 'path';
import winston from 'winston';

puppeteer.use(StealthPlugin());

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.simple()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

const MAX_RETRIES = 3;

export async function crearCuentaInstagram(proxy, retryCount = 0) {
  const fingerprint = generateAdaptiveFingerprint();
  const nombre = generarNombreCompleto();
  const username = generarNombreUsuario();
  const email = `${username.replace(/[^a-zA-Z0-9]/g, '')}@kraveapi.xyz`;
  const password = `Krave${Math.random().toString(36).slice(2, 8)}!`;
  const proxyStr = `${proxy.ip}:${proxy.port}`;
  const proxyUrl = `http://${proxy.auth.username}:${proxy.auth.password}@${proxy.ip}:${proxy.port}`;

  let browser, page;
  const screenshots = [];

  try {
    logger.info(`🌐 Usando proxy: ${proxyUrl}`);
    const esValido = await validateProxy(proxy);
    if (!esValido) throw new Error(`Proxy inválido: ${proxyUrl}`);

    const launchOptions = {
      headless: process.env.HEADLESS === 'true',
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
      args: [
        `--proxy-server=${proxyUrl}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--lang=en-US,en;q=0.9',
        '--window-size=1280,720',
        '--disable-blink-features=AutomationControlled'
      ],
      ignoreHTTPSErrors: true,
      defaultViewport: { width: 1280, height: 720 },
      slowMo: 50
    };

    browser = await puppeteer.launch(launchOptions);
    page = await browser.newPage();

    await page.setUserAgent(fingerprint.userAgent);
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9'
    });

    await page.emulateMediaFeatures([
      { name: 'prefers-color-scheme', value: 'light' },
      { name: 'prefers-reduced-motion', value: 'no-preference' }
    ]);

    await page.goto('https://www.instagram.com/accounts/emailsignup/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await page.waitForSelector('form', { visible: true, timeout: 10000 });

    const selectors = {
      email: 'input[name="emailOrPhone"]',
      fullName: 'input[name="fullName"]',
      username: 'input[name="username"]',
      password: 'input[name="password"]',
      submit: 'button[type="submit"]'
    };

    await page.type(selectors.email, email, { delay: 50 });
    await page.type(selectors.fullName, nombre, { delay: 50 });
    await page.type(selectors.username, username, { delay: 50 });
    await page.type(selectors.password, password, { delay: 50 });

    logger.info(`✅ Cuenta generada: ${username} | ${email}`);
    await page.click(selectors.submit);
    await page.waitForTimeout(10000);

    const cookies = await page.cookies();
    const cookiePath = path.join('cookies', `${username}.json`);
    fs.writeFileSync(cookiePath, JSON.stringify(cookies, null, 2));
    logger.info(`💾 Cookies guardadas en ${cookiePath}`);

    await browser.close();

    return {
      status: 'success',
      usuario: username,
      email,
      password,
      proxy: proxyStr
    };
  } catch (error) {
    const msg = `❌ Error en creación: ${error.message}`;
    logger.error(msg);

    if (page && !page.isClosed()) {
      const screenshot = `screenshots/error_${Date.now()}.png`;
      try {
        await page.screenshot({ path: screenshot });
        screenshots.push(screenshot);
        logger.info(`📸 Captura guardada: ${screenshot}`);
      } catch (err) {
        logger.error(`⚠️ Error al tomar screenshot: ${err.message}`);
      }
    }

    if (retryCount < MAX_RETRIES) {
      logger.warn(`🔁 Reintentando (${retryCount + 1}/${MAX_RETRIES})...`);
      await new Promise(res => setTimeout(res, 5000));
      return crearCuentaInstagram(proxy, retryCount + 1);
    }

    try {
      await notifyTelegram(`🚨 Fallo creando cuenta con ${proxyStr}: ${error.message}`);
    } catch (e) {
      logger.warn(`⚠️ No se pudo notificar por Telegram: ${e.message}`);
    }

    if (browser) await browser.close();
    return {
      status: 'failed',
      error: error.message,
      proxy: proxyStr,
      screenshots
    };
  }
}
