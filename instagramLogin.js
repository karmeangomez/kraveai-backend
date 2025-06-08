const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs').promises;
const path = require('path');
const proxyChain = require('proxy-chain');
const { loadCookies, saveCookies, validateCookies } = require('./cookies');
const UserAgent = require('user-agents');
puppeteer.use(StealthPlugin());

const COOKIE_PATH = path.join(__dirname, 'instagram_cookies.json');

let proxyIndex = 0;

function getNextProxy() {
  const rawList = process.env.PROXY_LIST;
  if (!rawList) return null;
  const proxies = rawList.split(';').map(p => p.trim()).filter(Boolean);
  if (proxies.length === 0) return null;
  const proxy = proxies[proxyIndex % proxies.length];
  proxyIndex++;
  return proxy;
}

async function launchBrowserWithProxy(proxyUrl) {
  const proxy = await proxyChain.anonymizeProxy(`http://${proxyUrl}`);
  const args = [
    `--proxy-server=${proxy}`,
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-blink-features=AutomationControlled',
    '--disable-gpu',
    '--window-size=1280,800'
  ];
  return puppeteer.launch({
    headless: 'new',
    args,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome',
    ignoreHTTPSErrors: true
  });
}

async function instagramLogin(page, username, password) {
  await page.setUserAgent(new UserAgent().toString());
  await page.setRequestInterception(true);
  page.on('request', req => {
    const blocked = ['image', 'stylesheet', 'font', 'media'];
    blocked.includes(req.resourceType()) ? req.abort() : req.continue();
  });

  await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'domcontentloaded', timeout: 30000 });

  const usernameInput = await page.waitForSelector('input[name="username"]', { timeout: 15000 });
  await usernameInput.type(username, { delay: 100 });

  const passwordInput = await page.waitForSelector('input[name="password"]', { timeout: 15000 });
  await passwordInput.type(password, { delay: 100 });

  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {})
  ]);

  const currentUrl = page.url();
  if (currentUrl.includes('/challenge') || currentUrl.includes('/two_factor')) {
    throw new Error('Challenge o verificación detectada');
  }

  const cookies = await page.cookies();
  await saveCookies(cookies);
  return true;
}

async function ensureLoggedIn() {
  const username = process.env.IG_USERNAME;
  const password = process.env.INSTAGRAM_PASS;
  const cookies = await loadCookies();

  if (validateCookies(cookies)) {
    console.log('[Cookies] Sesión válida encontrada');
    return true;
  } else {
    console.log('[Instagram] No se encontraron cookies válidas');
  }

  for (let i = 0; i < 5; i++) {
    const proxyUrl = getNextProxy();
    if (!proxyUrl) {
      throw new Error('No hay proxies disponibles');
    }

    console.log(`🔁 Intentando login con proxy: ${proxyUrl}`);
    let browser;

    try {
      browser = await launchBrowserWithProxy(proxyUrl);
      const page = await browser.newPage();
      const success = await instagramLogin(page, username, password);
      await browser.close();
      if (success) return true;
    } catch (err) {
      console.error(`⚠️ Proxy inválido: ${proxyUrl}`);
      if (browser) await browser.close();
    }
  }

  throw new Error('Todos los intentos de login fallaron');
}

module.exports = {
  ensureLoggedIn,
  instagramLogin
};
