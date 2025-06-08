require('dotenv').config();
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const proxyChain = require('proxy-chain');
const fs = require('fs/promises');
const path = require('path');
const axios = require('axios');
const userAgents = require('user-agents');

puppeteer.use(StealthPlugin());

const COOKIE_PATH = path.join(__dirname, 'cookies.json');
let cookiesCache = [];

async function notifyTelegram(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  try {
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text: message,
    });
  } catch (err) {
    console.warn('❌ Telegram error:', err.message);
  }
}

function validateCookies(cookies) {
  if (!Array.isArray(cookies)) return false;
  const session = cookies.find(c => c.name === 'sessionid');
  return session && session.expires * 1000 > Date.now();
}

async function saveCookies(page) {
  const cookies = await page.cookies();
  cookiesCache = cookies;
  await fs.writeFile(COOKIE_PATH, JSON.stringify(cookies, null, 2));
}

async function loadCookies(page) {
  try {
    const content = await fs.readFile(COOKIE_PATH, 'utf8');
    cookiesCache = JSON.parse(content);
    if (validateCookies(cookiesCache)) {
      await page.setCookie(...cookiesCache);
      return true;
    }
  } catch {}
  return false;
}

function getCookies() {
  return cookiesCache;
}

async function getProxy() {
  const list = process.env.PROXY_LIST?.split(';') || [];
  for (const raw of list) {
    try {
      const full = raw.startsWith('http') ? raw : `http://${raw}`;
      const anonymized = await proxyChain.anonymizeProxy(full);
      console.log(`✅ Proxy válido: ${raw}`);
      return anonymized;
    } catch {
      console.warn(`⚠️ Proxy inválido: ${raw}`);
    }
  }
  throw new Error('❌ No hay proxies válidos disponibles');
}

async function instagramLogin() {
  const IG_USERNAME = process.env.IG_USERNAME;
  const IG_PASSWORD = process.env.INSTAGRAM_PASS;
  if (!IG_USERNAME || !IG_PASSWORD) {
    throw new Error('❌ Falta IG_USERNAME o INSTAGRAM_PASS');
  }

  const proxy = await getProxy();
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
    args: [
      `--proxy-server=${proxy}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled'
    ],
    ignoreHTTPSErrors: true
  });

  const page = await browser.newPage();
  await page.setUserAgent(new userAgents().toString());
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

  const cookiesOk = await loadCookies(page);
  await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle2', timeout: 30000 });

  const alreadyLogged = await page.evaluate(() => {
    return !!document.querySelector('nav') || document.cookie.includes('sessionid');
  });

  if (cookiesOk && alreadyLogged) {
    console.log('✅ Sesión restaurada con cookies');
    return { browser };
  }

  await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle2' });
  await page.waitForSelector('input[name=username]', { timeout: 20000 });
  await page.type('input[name=username]', IG_USERNAME, { delay: 80 });
  await page.type('input[name=password]', IG_PASSWORD, { delay: 80 });
  await Promise.all([
    page.click('button[type=submit]'),
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 })
  ]);

  const url = page.url();
  if (url.includes('challenge')) {
    throw new Error('⚠️ Instagram solicitó verificación');
  }

  const cookies = await page.cookies();
  await saveCookies(page);
  console.log('✅ Login exitoso');
  return { browser };
}

module.exports = {
  instagramLogin,
  notifyTelegram,
  getCookies
};
