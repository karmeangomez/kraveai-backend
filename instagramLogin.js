// ✅ instagramLogin.js - Adaptado para ENCRYPTION_KEY, ENCRYPTION_IV e INSTAGRAM_PASS
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const COOKIE_PATH = path.join(__dirname, 'instagram_cookies.json');
let cookiesCache = [];

const CONFIG = {
  loginUrl: 'https://www.instagram.com/accounts/login/',
  userAgents: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  ],
  browserOptions: {
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--single-process'
    ]
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

async function performLogin(page, username, password) {
  try {
    const ua = CONFIG.userAgents[0];
    await page.setUserAgent(ua);
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
    await page.goto(CONFIG.loginUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('input[name="username"]');
    await page.type('input[name="username"]', username, { delay: 20 });
    await page.type('input[name="password"]', password, { delay: 20 });
    const [response] = await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }),
      page.click('button[type="submit"]')
    ]);

    if (response.status() >= 400) throw new Error(`HTTP ${response.status()}`);
    if (page.url().includes('/challenge')) throw new Error('Desafío de seguridad');

    await page.waitForSelector('nav[role="navigation"]', { timeout: 10000 });
    cookiesCache = await page.cookies();
    await fs.writeFile(COOKIE_PATH, JSON.stringify(cookiesCache, null, 2));
    console.log('[Instagram] Login exitoso');
    return true;
  } catch (error) {
    console.error('[Instagram] Error en login:', error.message);
    return false;
  }
}

async function ensureLoggedIn() {
  const username = process.env.IG_USERNAME || process.env.IG_USER;
  const password = process.env.ENCRYPTION_KEY ? decryptPassword() : process.env.INSTAGRAM_PASS;

  if (!username || !password) throw new Error('[Instagram] Credenciales no configuradas correctamente');
  if (await handleCookies()) return;

  const browser = await puppeteer.launch(CONFIG.browserOptions);
  const page = await browser.newPage();

  try {
    await page.setViewport({ width: 1280, height: 800 });
    const success = await performLogin(page, username, password);
    if (!success) throw new Error('Login fallido');
  } finally {
    await page.close();
    await browser.close();
  }
}

module.exports = {
  ensureLoggedIn,
  getCookies: () => cookiesCache
};
