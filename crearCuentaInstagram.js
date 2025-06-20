// crearCuentaInstagram.js actualizado con selectores parcheados y lógica rusa

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { generateFingerprint } = require('./fingerprint_utils');
const cambiarIdentidad = require('./cambiarIdentidad');
const { getEmail, getVerificationCode } = require('./imapVerifier');
const { shadowbanChecker } = require('./shadowbanChecker');
const { postCreationBot } = require('./postCreationBot');
const { logFingerprintResult } = require('./fingerprintTracker');
const Logger = require('./logger');
const { generar_usuario, generar_nombre } = require('./nombre_utils');

puppeteer.use(StealthPlugin());
const logger = new Logger();

const COOKIES_DIR = path.join(__dirname, 'cookies');
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');
const ACCOUNTS_FILE = path.join(__dirname, 'cuentas_creadas.json');

const delay = ms => new Promise(res => setTimeout(res, ms));

async function saveScreenshot(page, username, etapa) {
  if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  const pathFile = path.join(SCREENSHOTS_DIR, `${username}_${etapa}_${Date.now()}.png`);
  await page.screenshot({ path: pathFile });
}

async function saveCookies(page, username) {
  if (!fs.existsSync(COOKIES_DIR)) fs.mkdirSync(COOKIES_DIR, { recursive: true });
  const cookies = await page.cookies();
  fs.writeFileSync(path.join(COOKIES_DIR, `${username}.json`), JSON.stringify(cookies, null, 2));
}

async function saveAccount(data) {
  const line = JSON.stringify(data);
  fs.appendFileSync(ACCOUNTS_FILE, line + '\n');
}

async function humanType(page, selector, text) {
  await page.focus(selector);
  for (const char of text) {
    await page.type(selector, char, { delay: 50 + Math.random() * 40 });
    if (Math.random() > 0.7) await delay(Math.random() * 120);
  }
}

async function crearCuentaInstagram() {
  const fingerprint = generateFingerprint();
  const username = generar_usuario();
  const fullName = generar_nombre();
  const password = uuidv4().slice(0, 12);
  const email = await getEmail();

  const accountData = {
    usuario: username,
    email,
    password,
    fingerprint,
    status: 'error',
    screenshots: [],
    timestamp: new Date().toISOString()
  };

  let browser;

  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: '/usr/bin/chromium-browser',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await cambiarIdentidad(page, fingerprint);
    await page.goto('https://www.instagram.com/accounts/emailsignup/', { waitUntil: 'networkidle2' });

    // EMAIL input
    const emailSelectors = [
      'input[name="emailOrPhone"]',
      'input[name="email"]',
      'input[aria-label*="Correo"]',
      'input[aria-label*="Email"]'
    ];
    let emailSelectorUsado = null;
    for (const selector of emailSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 6000 });
        emailSelectorUsado = selector;
        break;
      } catch {}
    }
    if (!emailSelectorUsado) {
      accountData.screenshots.push(await saveScreenshot(page, username, 'no_email'));
      throw new Error('No se encontró input para email');
    }

    // FULL NAME input
    const fullNameSelector = 'input[name="fullName"]';
    await page.waitForSelector(fullNameSelector, { timeout: 5000 });

    // USERNAME input
    const usernameSelector = 'input[name="username"]';
    await page.waitForSelector(usernameSelector, { timeout: 5000 });

    // PASSWORD input
    const passwordSelector = 'input[name="password"]';
    await page.waitForSelector(passwordSelector, { timeout: 5000 });

    // Llenado
    logger.info(`📝 Llenando formulario para @${username}`);
    await humanType(page, emailSelectorUsado, email);
    await humanType(page, fullNameSelector, fullName);
    await humanType(page, usernameSelector, username);
    await humanType(page, passwordSelector, password);
    await page.click('button[type="submit"]');
    await delay(5000);

    // Código de verificación
    const codeInput = await page.$('input[name="email_confirmation_code"]');
    if (codeInput) {
      logger.info('📬 Esperando código de verificación...');
      const code = await getVerificationCode(email);
      if (!code) throw new Error('No se recibió código de verificación');
      await humanType(page, 'input[name="email_confirmation_code"]', code);
      await page.click('button[type="button"]');
      await delay(5000);
    }

    await saveCookies(page, username);
    await saveScreenshot(page, username, 'registrado');

    const isShadowbanned = await shadowbanChecker(username);
    if (isShadowbanned !== true) {
      accountData.status = 'shadowbanned';
      accountData.shadowban = true;
      logger.warn(`⚠️ Cuenta @${username} fue shadowbaneada`);
    } else {
      accountData.status = 'success';
      logger.success(`✅ Cuenta @${username} creada y visible`);
    }

    const postActiva = await postCreationBot({ username, password });
    if (postActiva) accountData.postCreation = true;

  } catch (error) {
    accountData.error = error.message;
    logger.error(`❌ Error en cuenta @${username}: ${error.message}`);
  } finally {
    if (browser) await browser.close();
    await saveAccount(accountData);
    logFingerprintResult(fingerprint, accountData.status);
    console.log(JSON.stringify(accountData));
  }
}

crearCuentaInstagram();
