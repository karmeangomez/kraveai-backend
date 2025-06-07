// ✅ instagramLogin.js con rotación de proxies y cookies seguras
require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const proxyChain = require('proxy-chain');
const { Telegraf } = require('telegraf');
const { loadCookies, saveCookies, getCookies, validateCookies } = require('./cookies');
const UserAgent = require('user-agents');

puppeteer.use(StealthPlugin());

const COOKIE_PATH = path.join(__dirname, 'instagram_cookies.json');
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const bot = TELEGRAM_BOT_TOKEN ? new Telegraf(TELEGRAM_BOT_TOKEN) : null;

function notifyTelegram(msg) {
  if (!bot || !TELEGRAM_CHAT_ID) return;
  return bot.telegram.sendMessage(TELEGRAM_CHAT_ID, msg).catch(() => {});
}

let proxyIndex = 0;
function getNextProxy() {
  if (!process.env.PROXY_LIST) return null;
  const proxies = process.env.PROXY_LIST.split(';').map(p => p.trim()).filter(p => p);
  if (proxies.length === 0) return null;
  const proxy = proxies[proxyIndex % proxies.length];
  proxyIndex++;
  return proxy;
}

async function smartLogin(page, username, password) {
  await page.setUserAgent(new UserAgent().toString());
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

  await page.goto('https://www.instagram.com/accounts/login/', {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });

  const inputSelectors = [
    'input[name="username"]',
    'input[aria-label*="Phone number"]',
    'input[type="text"]'
  ];

  let usernameSelector;
  for (const selector of inputSelectors) {
    const found = await page.$(selector);
    if (found) {
      usernameSelector = selector;
      break;
    }
  }

  if (!usernameSelector) {
    throw new Error('No se encontró ningún campo de username.');
  }

  await page.type(usernameSelector, username, { delay: 50 });
  await page.type('input[name="password"]', password, { delay: 50 });

  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 })
  ]);

  const currentUrl = page.url();
  if (currentUrl.includes('challenge')) {
    throw new Error('Instagram activó desafío de seguridad.');
  }

  const cookies = await page.cookies();
  await saveCookies(cookies);
  return true;
}

async function instagramLogin() {
  const username = process.env.IG_USERNAME;
  const password = process.env.INSTAGRAM_PASS;
  if (!username || !password) throw new Error('Credenciales Instagram no configuradas');

  let proxyUrl = null;
  const rawProxy = getNextProxy();
  if (rawProxy) {
    try {
      proxyUrl = await proxyChain.anonymizeProxy(`http://${rawProxy}`);
    } catch {
      notifyTelegram(`❌ Proxy inválido o incompatible: ${rawProxy}`);
    }
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-blink-features=AutomationControlled',
      '--single-process',
      ...(proxyUrl ? [`--proxy-server=${proxyUrl}`] : [])
    ],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome',
    ignoreHTTPSErrors: true
  });

  const page = await browser.newPage();
  const cookies = await loadCookies();

  if (validateCookies(cookies)) {
    await page.setCookie(...cookies);
    await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded' });
    const isLoggedIn = await page.evaluate(() => {
      return !!document.querySelector('a[href="/accounts/edit/"]');
    });
    if (isLoggedIn) {
      return { browser, page };
    }
  }

  await smartLogin(page, username, password);
  return { browser, page };
}

module.exports = {
  instagramLogin,
  getCookies,
  notifyTelegram
};
