const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const proxyChain = require('proxy-chain');
const fs = require('fs').promises;
const path = require('path');
const UserAgent = require('user-agents');
const { loadCookies, saveCookies, validateCookies, getCookies } = require('./cookies');
const { Telegraf } = require('telegraf');
require('dotenv').config();

puppeteer.use(StealthPlugin());

// Proxy rotación inteligente

const proxies = process.env.PROXY_LIST_A?.split(";").concat(process.env.PROXY_LIST_B?.split(";")).filter(Boolean);
let proxyIndex = 0;

function getNextProxy() {
  if (!proxies || proxies.length === 0) return null;
  const proxy = proxies[proxyIndex % proxies.length];
  proxyIndex++;
  return proxy;
}


const telegramBot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const COOKIE_PATH = path.join(__dirname, 'instagram_cookies.json');

async function notifyTelegram(message) {
  if (!telegramBot || !TELEGRAM_CHAT_ID) return;
  try {
    await telegramBot.telegram.sendMessage(TELEGRAM_CHAT_ID, message);
  } catch (err) {
    console.error('[Telegram] Error:', err.message);
  }
}

async function instagramLogin() {
  const username = process.env.IG_USERNAME;
  const password = process.env.INSTAGRAM_PASS;

  if (!username || !password) {
    throw new Error('❌ IG_USERNAME o INSTAGRAM_PASS no definidos');
  }

  const cookies = await loadCookies();
  let proxy = getNextProxy();
  let newProxyUrl = proxy ? await proxyChain.anonymizeProxy('http://' + proxy) : null;

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      ...(newProxyUrl ? [`--proxy-server=${newProxyUrl}`] : [])
    ],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome',
    ignoreHTTPSErrors: true
  });

  const page = await browser.newPage();

  if (validateCookies(cookies)) {
    await page.setCookie(...cookies);
    await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle2', timeout: 30000 });
    const loggedIn = await page.evaluate(() =>
      document.querySelector('nav')?.innerText?.includes('Inicio')
    );
    if (loggedIn) {
      console.log('✅ Sesión restaurada con cookies');
      return { browser };
    }
  }

  await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('input[name="username"]', { timeout: 10000 });

  const userAgent = new UserAgent();
  await page.setUserAgent(userAgent.toString());

  await page.type('input[name="username"]', username, { delay: 50 });
  await page.type('input[name="password"]', password, { delay: 50 });
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 })
  ]);

  const url = page.url();
  if (url.includes('challenge')) {
    await notifyTelegram('⚠️ Instagram solicitó verificación adicional');
    throw new Error('⚠️ Desafío de seguridad detectado');
  }

  const finalCookies = await page.cookies();
  await saveCookies(finalCookies);
  console.log('✅ Login exitoso y cookies guardadas');

  return { browser };
}

module.exports = {
  instagramLogin,
  getCookies,
  notifyTelegram
};
