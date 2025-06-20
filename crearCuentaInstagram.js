const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { generateFingerprint } = require('./fingerprint_utils');
const cambiarIdentidad = require('./cambiarIdentidad');
const { getEmail, getVerificationCode } = require('./imapVerifier');
const { shadowbanChecker } = require('./shadowbanChecker');
const { postCreationBot } = require('./postCreationBot');
const { logFingerprintResult } = require('./fingerprintTracker');
const Logger = require('./logger');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { faker } = require('@faker-js/faker');

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
  const username = faker.internet.userName().toLowerCase().replace(/[^a-z0-9_]/g, '') + Math.floor(Math.random() * 10000);
  const fullName = faker.person.fullName(); // ✅ faker v8+
  const password = uuidv4().slice(0, 12);
  const email = getEmail();

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

    logger.info(`📝 Llenando formulario para @${username}`);
    await humanType(page, 'input[name="emailOrPhone"]', email);
    await humanType(page, 'input[name="fullName"]', fullName);
    await humanType(page, 'input[name="username"]', username);
    await humanType(page, 'input[name="password"]', password);
    await page.click('button[type="submit"]');
    await delay(5000);

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
    if (postActiva) {
      accountData.postCreation = true;
    }

  } catch (error) {
    accountData.error = error.message;
    logger.error(`❌ Error en cuenta @${username}: ${error.message}`);
  } finally {
    if (browser) await browser.close();
    await saveAccount(accountData);
    logFingerprintResult(fingerprint, accountData.status);
    console.log(JSON.stringify(accountData)); // usado por runCrearCuentasTurbo.js
  }
}

crearCuentaInstagram();
