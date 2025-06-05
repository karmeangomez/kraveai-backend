// ✅ instagramLogin.js ultra mejorado con estabilidad reforzada
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const UserAgent = require('user-agents');
const { Telegraf } = require('telegraf');
const proxyChain = require('proxy-chain');

const COOKIE_PATH = path.join(__dirname, 'instagram_cookies.json');
let cookiesCache = [];

const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const telegramBot = TELEGRAM_BOT_TOKEN ? new Telegraf(TELEGRAM_BOT_TOKEN) : null;

// Sistema de reintentos con backoff exponencial
async function withRetry(fn, maxAttempts = 3, delayBase = 2000) {
  let attempt = 0;
  while (attempt < maxAttempts) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      if (attempt >= maxAttempts) throw error;
      
      const delay = delayBase * Math.pow(2, attempt);
      console.warn(`⚠️ Reintento #${attempt} en ${delay}ms. Error: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

async function notifyTelegram(message) {
  if (!telegramBot || !TELEGRAM_CHAT_ID) return;
  try {
    await telegramBot.telegram.sendMessage(TELEGRAM_CHAT_ID, message);
    console.log('📩 Notificación enviada a Telegram:', message);
  } catch (err) {
    console.error('❌ Error al enviar notificación Telegram:', err.message);
  }
}

async function sendScreenshot(page, message) {
  if (!telegramBot || !TELEGRAM_CHAT_ID) return;
  try {
    const screenshot = await page.screenshot({ fullPage: true });
    await telegramBot.telegram.sendPhoto(TELEGRAM_CHAT_ID, { source: screenshot }, { caption: message });
    console.log('📸 Captura enviada a Telegram');
  } catch (err) {
    console.error('❌ Error al enviar captura:', err.message);
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
      '--disable-blink-features=AutomationControlled',
      '--single-process',
      '--disable-infobars',
      '--window-size=1280,800'
    ],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome',
    ignoreHTTPSErrors: true
  }
};

// Sistema de proxy rotativo
async function getProxy() {
  if (!process.env.PROXY_LIST) return null;
  
  const proxies = process.env.PROXY_LIST.split(';');
  const randomProxy = proxies[Math.floor(Math.random() * proxies.length)];
  
  try {
    const newProxyUrl = await proxyChain.anonymizeProxy(randomProxy);
    console.log(`🔒 Usando proxy: ${newProxyUrl}`);
    return newProxyUrl;
  } catch (error) {
    console.error('❌ Error configurando proxy:', error.message);
    return null;
  }
}

function decryptPassword() {
  try {
    if (!process.env.ENCRYPTION_KEY || !process.env.ENCRYPTION_IV) {
      throw new Error('Faltan variables de encriptación');
    }
    
    const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
    const iv = Buffer.from(process.env.ENCRYPTION_IV, 'hex');
    
    if (key.length !== 32 || iv.length !== 16) {
      throw new Error('Tamaño inválido de clave o IV');
    }
    
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
    
    // Verificar todas las cookies importantes
    const requiredCookies = ['sessionid', 'ds_user_id', 'ig_did'];
    const missingCookies = requiredCookies.filter(name => 
      !cookiesCache.some(c => c.name === name)
    );
    
    if (missingCookies.length > 0) {
      console.warn(`[Instagram] Faltan cookies requeridas: ${missingCookies.join(', ')}`);
      return false;
    }
    
    const sessionCookie = cookiesCache.find(c => c.name === 'sessionid');
    const isValidSession = sessionCookie?.expires > Date.now() / 1000;
    
    if (isValidSession) {
      console.log('[Instagram] Sesión válida encontrada');
      return true;
    }
    
    console.warn('[Instagram] Sesión expirada');
  } catch (error) {
    console.warn('[Instagram] No se encontraron cookies válidas:', error.message);
  }
  return false;
}

async function humanType(page, selector, text) {
  const element = await page.$(selector);
  if (!element) throw new Error(`Elemento no encontrado: ${selector}`);
  
  await element.click();
  await page.waitForTimeout(300);
  
  // Escribir caracter por caracter con variaciones humanas
  for (let i = 0; i < text.length; i++) {
    await element.type(text[i], {
      delay: Math.floor(Math.random() * 120) + 30
    });
    
    // Pausas aleatorias para simular dudas
    if (Math.random() > 0.85 && i < text.length - 1) {
      await page.waitForTimeout(Math.random() * 500 + 100);
    }
  }
}

async function smartLogin(page, username, password) {
  const userAgent = new UserAgent({
    deviceCategory: 'desktop',
    platform: 'Win32'
  }).toString();
  
  console.log("🧪 Usando User-Agent:", userAgent);
  await page.setUserAgent(userAgent);
  await page.setExtraHTTPHeaders({ 
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br'
  });
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1, isMobile: false });

  // Navegar a la página de login con diagnóstico mejorado
  const response = await withRetry(async () => {
    return page.goto(CONFIG.loginUrl, { 
      waitUntil: 'networkidle0', 
      timeout: 30000 
    });
  }, 2, 3000);
  
  console.log("🌐 Código de estado HTTP:", response.status());
  
  // Captura de diagnóstico si hay problemas
  const diagnostic = async (message) => {
    console.error(message);
    const html = await page.content();
    console.log("📄 HTML de la página:", html.slice(0, 1000));
    await sendScreenshot(page, `Instagram Login Error: ${message}`);
    await notifyTelegram(message);
  };

  // Detectar si estamos en página bloqueada
  if (await page.$('div[id="slfErrorAlert"]')) {
    const errorText = await page.$eval('div[id="slfErrorAlert"]', el => el.textContent);
    await diagnostic(`❌ Instagram bloqueó el acceso: ${errorText}`);
    throw new Error('IP bloqueada por Instagram');
  }

  // Sistema mejorado de detección de campos
  const usernameSelectors = [
    'input[name="username"]',
    'input[name="emailOrPhone"]',
    'input[aria-label*="Phone number"]',
    'input[type="text"][autocomplete="username"]',
    'input[placeholder*="username"]',
    'input[autocomplete="username"]',
    'input[aria-label*="Username"]'
  ];

  let foundUsernameField = false;
  for (const selector of usernameSelectors) {
    if (await page.$(selector)) {
      foundUsernameField = true;
      try {
        await humanType(page, selector, username);
        break;
      } catch (error) {
        await diagnostic(`⚠️ Error al escribir en ${selector}: ${error.message}`);
      }
    }
  }

  if (!foundUsernameField) {
    await diagnostic('❌ No se encontró ningún campo de username');
    throw new Error('No se encontró ningún campo de username.');
  }

  // Campo de contraseña
  const passwordSelectors = [
    'input[name="password"]',
    'input[type="password"][autocomplete="current-password"]',
    'input[aria-label*="Password"]'
  ];

  let foundPasswordField = false;
  for (const selector of passwordSelectors) {
    if (await page.$(selector)) {
      foundPasswordField = true;
      try {
        await humanType(page, selector, password);
        break;
      } catch (error) {
        await diagnostic(`⚠️ Error al escribir en ${selector}: ${error.message}`);
      }
    }
  }

  if (!foundPasswordField) {
    await diagnostic('❌ No se encontró campo de password');
    throw new Error('No se encontró campo de password.');
  }

  // Botón de login
  const loginButtons = [
    'button[type="submit"]',
    'div[role="button"][type="submit"]',
    'button:contains("Log in")'
  ];

  let loginClicked = false;
  for (const selector of loginButtons) {
    const button = await page.$(selector);
    if (button) {
      try {
        await button.click();
        loginClicked = true;
        break;
      } catch (error) {
        console.warn(`⚠️ Error al hacer clic en ${selector}: ${error.message}`);
      }
    }
  }

  if (!loginClicked) {
    await diagnostic('❌ No se encontró botón de login');
    throw new Error('No se encontró botón de login.');
  }

  // Esperar navegación o detección de problemas
  try {
    await Promise.race([
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }),
      page.waitForSelector('input[aria-label*="Verification Code"]', { timeout: 10000 }),
      page.waitForSelector('img[alt="Instagram"]', { timeout: 10000 })
    ]);
  } catch (error) {
    // Continuar incluso si no hay navegación
  }

  // Detectar desafíos de seguridad
  const currentUrl = page.url();
  if (currentUrl.includes('challenge') || 
      currentUrl.includes('checkpoint') || 
      await page.$('input[aria-label*="Verification Code"]')) {
    await diagnostic('⚠️ Instagram solicitó verificación adicional (2FA o captcha)');
    return false;
  }

  // Verificar si el login fue exitoso
  const loginSuccess = await page.evaluate(() => {
    return document.querySelector('a[href*="/accounts/activity/"]') !== null;
  });

  if (!loginSuccess) {
    await diagnostic('❌ Login fallido - Redirección incorrecta');
    throw new Error('Login fallido - Redirección incorrecta');
  }

  // Guardar cookies
  cookiesCache = await page.cookies();
  await fs.writeFile(COOKIE_PATH, JSON.stringify(cookiesCache, null, 2));
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
  if (!password) throw new Error('[Instagram] INSTAGRAM_PASS no pudo obtenerse');

  // Verificar cookies existentes
  if (await handleCookies()) return;

  // Configurar proxy si está disponible
  const proxyUrl = await getProxy();
  const browserOptions = {
    ...CONFIG.browserOptions,
    ...(proxyUrl ? { args: [...CONFIG.browserOptions.args, `--proxy-server=${proxyUrl}`] } : {})
  };

  const browser = await puppeteer.launch(browserOptions);
  const page = await browser.newPage();

  try {
    const loginSuccess = await withRetry(
      () => smartLogin(page, username, password), 
      3, 
      5000
    );
    
    if (!loginSuccess) {
      throw new Error('Login fallido por desafío de seguridad');
    }
  } catch (error) {
    await sendScreenshot(page, `❌ Error crítico en login: ${error.message}`);
    await notifyTelegram(`❌ Error al iniciar sesión de Instagram: ${error.message}`);
    throw error;
  } finally {
    await browser.close();
  }
}

module.exports = {
  ensureLoggedIn,
  getCookies: () => cookiesCache,
  notifyTelegram
};
