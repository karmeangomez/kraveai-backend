// ✅ instagramLogin.js optimizado para evitar SIGTERM (memoria, cierre seguro)
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const UserAgent = require('user-agents');
const { Telegraf } = require('telegraf');
const axios = require('axios');
const { loadCookies, saveCookies, getCookies, validateCookies } = require('./cookies');

const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const telegramBot = TELEGRAM_BOT_TOKEN ? new Telegraf(TELEGRAM_BOT_TOKEN) : null;

async function notifyTelegram(message) {
  if (!telegramBot || !TELEGRAM_CHAT_ID) return;
  try {
    await telegramBot.telegram.sendMessage(TELEGRAM_CHAT_ID, message);
    console.log('📩 Notificación enviada a Telegram:', message);
  } catch (err) {
    console.error('❌ Error al enviar notificación Telegram:', err.message);
  }
}

const CONFIG = {
  loginUrl: 'https://www.instagram.com/accounts/login/',
  browserOptions: {
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-accelerated-2d-canvas',
      '--disable-dev-tools',
      '--no-zygote',
      '--single-process',
      '--js-flags=--max-old-space-size=256',
      '--window-size=1280,800',
      '--disable-blink-features=AutomationControlled'
    ],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome',
    ignoreHTTPSErrors: true,
    pipe: true // Optimizar comunicación con Chromium
  }
};

const proxyList = [];
let proxyIndex = 0;

async function updateProxies() {
  try {
    const response = await axios.get('https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=10000&country=all');
    proxyList.push(...response.data.split('\n').filter(p => p));
    console.log(`📡 Cargados ${proxyList.length} proxies`);
  } catch (error) {
    console.error("⚠️ Error cargando proxies:", error.message);
  }
}

function getNextProxy() {
  if (proxyIndex % 10 === 0) updateProxies().catch(() => {});
  const proxy = proxyList[proxyIndex] || '';
  proxyIndex = (proxyIndex + 1) % proxyList.length || 0;
  return proxy ? `--proxy-server=http://${proxy}` : '';
}

const humanBehavior = {
  randomDelay: (min = 500, max = 2000) => new Promise(resolve => setTimeout(resolve, min + Math.random() * (max - min))),
  randomType: async (page, selector, text) => {
    for (let char of text) {
      await page.keyboard.press(char);
      await humanBehavior.randomDelay(50, 150);
    }
  },
  randomScroll: async (page) => {
    const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
    for (let i = 0; i < 2; i++) {
      await page.evaluate(h => window.scrollBy(0, h * Math.random()), scrollHeight * 0.5);
      await humanBehavior.randomDelay(500, 1500);
    }
  },
  randomMouseMovement: async (page) => {
    const viewport = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
    for (let i = 0; i < 3; i++) {
      const x = Math.random() * viewport.width;
      const y = Math.random() * viewport.height;
      await page.mouse.move(x, y, { steps: 10 });
      await humanBehavior.randomDelay(200, 500);
    }
  },
  randomClick: async (page) => {
    const nonInteractive = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('p, span, img'));
      return elements[Math.floor(Math.random() * elements.length)]?.getBoundingClientRect();
    });
    if (nonInteractive) {
      await page.mouse.click(nonInteractive.x + 5, nonInteractive.y + 5);
      await humanBehavior.randomDelay(500, 1000);
    }
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
  const cookies = await loadCookies();
  if (validateCookies(cookies)) {
    return true;
  }
  return false;
}

async function smartLogin(page, username, password) {
  const userAgent = new UserAgent({ deviceCategory: 'desktop' }).toString();
  console.log("🧪 Usando User-Agent:", userAgent);
  await page.setUserAgent(userAgent);
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
  await page.setViewport({ width: 1280, height: 800 });

  const referers = ['https://www.google.com/search', 'https://twitter.com/explore', 'https://facebook.com'];
  await page.goto(referers[Math.floor(Math.random() * referers.length)], { waitUntil: 'domcontentloaded', timeout: 5000 });
  await humanBehavior.randomScroll(page);

  const response = await page.goto(CONFIG.loginUrl, { waitUntil: 'networkidle0' });
  console.log("🌐 Código de estado HTTP:", response.status());

  const selectors = [
    'input[name="username"]',
    'input[name="emailOrPhone"]',
    'input[aria-label*="Phone number"]',
    'input[type="text"]',
    'input[placeholder*="username"]',
    'input[autocomplete="username"]'
  ];

  let foundSelector = false;
  for (const selector of selectors) {
    try {
      await page.waitForSelector(selector, { timeout: 60000 });
      await page.click(selector);
      await humanBehavior.randomType(page, selector, username);
      foundSelector = true;
      break;
    } catch (_) {
      console.warn(`⚠️ Selector no encontrado: ${selector}`);
    }
  }

  if (!foundSelector) {
    const html = await page.content();
    console.log("📄 HTML de la página:", html.slice(0, 1000));
    await notifyTelegram('❌ No se encontró ningún campo de username. Revisa si Instagram cambió la página de login.');
    throw new Error('No se encontró ningún campo de username.');
  }

  const passwordSelector = await page.$('input[name="password"]') || await page.$('input[type="password"]');
  if (!passwordSelector) {
    await notifyTelegram('❌ No se encontró ningún campo de password.');
    throw new Error('No se encontró ningún campo de password.');
  }
  await page.click('input[name="password"]');
  await humanBehavior.randomType(page, 'input[name="password"]', password);

  await humanBehavior.randomMouseMovement(page);
  await humanBehavior.randomClick(page);

  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60000 })
  ]);

  const url = page.url();
  if (url.includes('challenge') || url.includes('captcha')) {
    await notifyTelegram('⚠️ Instagram lanzó un desafío o captcha en el login de kraveaibot.');
    return false;
  }

  const cookies = await page.cookies();
  await saveCookies(cookies);
  console.log('[Instagram] Login exitoso con comportamiento humano');
  await notifyTelegram('✅ Sesión de kraveaibot iniciada correctamente');
  return true;
}

async function ensureLoggedIn() {
  const username = process.env.IG_USERNAME || process.env.IG_USER;
  const password = process.env.ENCRYPTION_KEY ? decryptPassword() : process.env.INSTAGRAM_PASS;

  console.log("🧪 Username:", username || 'NO DEFINIDO');
  console.log("🧪 Chrome path:", process.env.PUPPETEER_EXECUTABLE_PATH);

  if (!username) throw new Error('[Instagram] IG_USERNAME no está definido');
  if (!password) throw new Error('[Instagram] INSTAGRAM_PASS no pudo desencriptarse');

  if (await handleCookies()) return;

  let browser;
  try {
    const proxyArg = getNextProxy();
    if (proxyArg) CONFIG.browserOptions.args.push(proxyArg);
    browser = await puppeteer.launch(CONFIG.browserOptions);
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      window.navigator.chrome = { runtime: {} };
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    });

    // Prueba de conexión
    await page.goto('https://www.google.com', { timeout: 10000 }).catch(err => {
      throw new Error(`Error de conexión a internet: ${err.message}`);
    });

    const success = await smartLogin(page, username, password);
    if (!success) throw new Error('Login fallido');
  } catch (error) {
    console.error('❌ Error al iniciar sesión de Instagram:', error.message);
    await notifyTelegram(`❌ Error al iniciar sesión de Instagram: ${error.message}`);
    throw error;
  } finally {
    if (browser) {
      console.log('🔌 Cerrando navegador...');
      await browser.close();
      console.log('✅ Navegador cerrado correctamente');
    }
  }
}

// Manejo de cierre seguro para evitar SIGTERM
process.on('SIGTERM', async () => {
  console.log('⚠️ Recibida señal SIGTERM. Cerrando recursos...');
  if (telegramBot) await telegramBot.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('⚠️ Recibida señal SIGINT. Cerrando recursos...');
  if (telegramBot) await telegramBot.stop();
  process.exit(0);
});

module.exports = {
  ensureLoggedIn,
  getCookies,
  notifyTelegram
};