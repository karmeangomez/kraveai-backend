const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs').promises;
const path = require('path');
const proxyChain = require('proxy-chain');
const { Telegraf } = require('telegraf');

puppeteer.use(StealthPlugin());

const COOKIE_PATH = path.join(__dirname, 'instagram_cookies.json');
let cookiesCache = [];

const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const bot = TELEGRAM_BOT_TOKEN ? new Telegraf(TELEGRAM_BOT_TOKEN) : null;
const PROXY_LIST = process.env.PROXY_LIST ? process.env.PROXY_LIST.split(',').map(p => p.trim()) : [];

async function notifyTelegram(msg) {
  if (!bot || !TELEGRAM_CHAT_ID) return;
  try {
    await bot.telegram.sendMessage(TELEGRAM_CHAT_ID, msg);
  } catch (err) {
    console.error('❌ Telegram error:', err.message);
  }
}

function getCookies() {
  return cookiesCache;
}

function validateCookies(cookies) {
  const session = cookies.find(c => c.name === 'sessionid');
  return session && (!session.expires || session.expires > Date.now() / 1000);
}

async function saveCookies(cookies) {
  cookiesCache = cookies;
  await fs.writeFile(COOKIE_PATH, JSON.stringify(cookies, null, 2));
}

async function loadCookies(page) {
  try {
    const data = await fs.readFile(COOKIE_PATH, 'utf8');
    const cookies = JSON.parse(data);
    if (validateCookies(cookies)) {
      await page.setCookie(...cookies);
      cookiesCache = cookies;
      await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle2', timeout: 20000 });
      const valid = await page.evaluate(() => !!document.querySelector('nav'));
      return valid;
    }
  } catch {}
  return false;
}

async function getProxy() {
  if (!PROXY_LIST.length) return null;
  for (const raw of PROXY_LIST) {
    try {
      const anon = await proxyChain.anonymizeProxy(`http://${raw}`);
      return anon;
    } catch (err) {
      console.warn('⚠️ Proxy inválido:', raw);
    }
  }
  throw new Error('No hay proxies válidos disponibles');
}

async function instagramLogin() {
  const username = process.env.IG_USERNAME;
  const password = process.env.INSTAGRAM_PASS;

  if (!username || !password) throw new Error('Credenciales IG faltantes');

  const proxyUrl = await getProxy();

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      ...(proxyUrl ? [`--proxy-server=${proxyUrl}`] : [])
    ],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium'
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36');
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

  if (await loadCookies(page)) {
    console.log('✅ Cookies válidas reutilizadas');
    return { browser, page, cookies: cookiesCache };
  }

  console.log('🔐 Iniciando login nuevo...');
  await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('input[name="username"]', { timeout: 10000 });
  await page.type('input[name="username"]', username);
  await page.type('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 });

  const cookies = await page.cookies();
  await saveCookies(cookies);

  return { browser, page, cookies };
}

module.exports = { instagramLogin, getCookies, notifyTelegram };
