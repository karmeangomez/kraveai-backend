// ✅ instagramLogin.js - Adaptado para ENCRYPTION_KEY, ENCRYPTION_IV e INSTAGRAM_PASS
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const UserAgent = require('user-agents');

const COOKIE_PATH = path.join(__dirname, 'instagram_cookies.json');
let cookiesCache = [];

const CONFIG = {
  loginUrl: 'https://www.instagram.com/accounts/login/',
  browserOptions: {
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-blink-features=AutomationControlled',
      '--single-process'
    ],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome',
    ignoreHTTPSErrors: true
  }
};

function decryptPassword() {
  try {
    const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
    const iv = Buffer.from(process.env.ENCRYPTION_IV, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    return decipher.update(process.env.INSTAGRAM_PASS, 'base64', 'utf8') + decipher.final('utf8');
  } catch (error) {
    console.error('[Instagram] Error de desencriptación:', error.message);
    return process.env.INSTAGRAM_PASS;
  }
}

async function handleCookies() {
  try {
    const data = await fs.readFile(COOKIE_PATH, 'utf8');
    cookiesCache = JSON.parse(data);
    const sessionCookie = cookiesCache.find(c => c.name === 'sessionid');
    if (sessionCookie?.expires > Date.now() / 1000) {
      console.log('[Instagram] Sesión válida encontrada');
      return true;
    }
  } catch (_) {
    console.warn('[Instagram] No se encontraron cookies válidas');
  }
  return false;
}

async function smartLogin(page, username, password) {
  const userAgent = new UserAgent();
  await page.setUserAgent(userAgent.toString());
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
  await page.setViewport({ width: 1280, height: 800 });

  await page.goto(CONFIG.loginUrl, { waitUntil: 'networkidle0' });
  await page.waitForSelector('input[name="username"]', { visible: true });
  await page.waitForSelector('input[name="password"]', { visible: true });
  await page.waitForSelector('button[type="submit"]', { visible: true });

  await page.mouse.move(100, 150, { steps: 20 });
  await page.mouse.move(120, 180, { steps: 15 });

  await page.click('input[name="username"]');
  for (const char of username) {
    await page.keyboard.press(char);
    await page.waitForTimeout(Math.random() * 100 + 50);
  }

  await page.click('input[name="password"]');
  for (const char of password) {
    await page.keyboard.press(char);
    await page.waitForTimeout(Math.random() * 100 + 50);
  }

  await page.waitForTimeout(300);
  await page.evaluate(() => window.scrollBy(0, Math.floor(Math.random() * 100)));

  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'networkidle0' })
  ]);

  const currentUrl = page.url();
  if (currentUrl.includes('/challenge') || currentUrl.includes('/two_factor')) {
    throw new Error('Desafío de seguridad o 2FA requerido.');
  }

  cookiesCache = await page.cookies();
  await fs.writeFile(COOKIE_PATH, JSON.stringify(cookiesCache, null, 2));
  console.log('[Instagram] Login exitoso con comportamiento humano');
  return true;
}

async function ensureLoggedIn() {
  const username = process.env.IG_USERNAME || process.env.IG_USER;
  const password = process.env.ENCRYPTION_KEY ? decryptPassword() : process.env.INSTAGRAM_PASS;

  console.log("🧪 Username:", username || 'NO DEFINIDO');
  console.log("🧪 Password (desencriptada):", password || 'NO DEFINIDO');
  console.log("🧪 Chrome path:", process.env.PUPPETEER_EXECUTABLE_PATH);

  if (!username) throw new Error('[Instagram] IG_USERNAME no está definido');
  if (!password) throw new Error('[Instagram] INSTAGRAM_PASS no pudo desencriptarse');

  if (await handleCookies()) return;

  const browser = await puppeteer.launch(CONFIG.browserOptions);
  const page = await browser.newPage();

  try {
    await page.setViewport({ width: 1280, height: 800 });
    const success = await smartLogin(page, username, password);
    if (!success) throw new Error('Login fallido');
  } finally {
    await browser.close();
  }
}

module.exports = {
  ensureLoggedIn,
  getCookies: () => cookiesCache
};
