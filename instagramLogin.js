const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs').promises;
const path = require('path');
const proxyChain = require('proxy-chain');
const { Telegraf } = require('telegraf');
const axios = require('axios');

puppeteer.use(StealthPlugin());

const COOKIE_PATH = path.join(__dirname, 'instagram_cookies.json');
let cookiesCache = [];

const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const bot = TELEGRAM_BOT_TOKEN ? new Telegraf(TELEGRAM_BOT_TOKEN) : null;
const PROXY_LIST = process.env.PROXY_LIST ? 
  process.env.PROXY_LIST.split(',').map(p => p.trim()).filter(Boolean) : [];

// Validación de formato de proxy
const isValidProxy = proxy => /^[^:@]+:[^:@]+@[^:]+:\d+$/.test(proxy);

async function notifyTelegram(msg) {
  if (!bot || !TELEGRAM_CHAT_ID) return;
  try {
    await bot.telegram.sendMessage(TELEGRAM_CHAT_ID, msg);
    console.log(`📩 Telegram: ${msg}`);
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
    
    if (!validateCookies(cookies)) {
      console.log('⚠️ Cookies inválidas o expiradas');
      return false;
    }
    
    await page.setCookie(...cookies);
    cookiesCache = cookies;
    
    // Verificación rápida de sesión
    await page.goto('https://www.instagram.com/', { 
      waitUntil: 'domcontentloaded', 
      timeout: 15000 
    });
    
    const sessionActive = await page.evaluate(() => {
      return !!document.querySelector('a[href*="/accounts/activity/"]');
    });
    
    return sessionActive;
  } catch (err) {
    console.warn('❌ Error cargando cookies:', err.message);
    return false;
  }
}

async function testProxy(proxy) {
  try {
    const [userPass, hostPort] = proxy.split('@');
    const [host, port] = hostPort.split(':');
    const [username, password] = userPass.split(':');
    
    const response = await axios.get('https://www.instagram.com', {
      proxy: {
        host,
        port: parseInt(port),
        auth: { username, password }
      },
      timeout: 5000
    });
    
    return response.status === 200;
  } catch {
    return false;
  }
}

async function getProxy() {
  // Filtrar proxies válidos
  const validProxies = [];
  
  for (const proxy of PROXY_LIST) {
    if (!isValidProxy(proxy)) {
      console.warn(`⚠️ Proxy con formato inválido: ${proxy}`);
      notifyTelegram(`❌ Proxy mal formado: ${proxy}`);
      continue;
    }
    
    if (await testProxy(proxy)) {
      console.log(`✅ Proxy funcional: ${proxy.split('@')[1]}`);
      validProxies.push(proxy);
    } else {
      console.warn(`⚠️ Proxy falló prueba: ${proxy.split('@')[1]}`);
    }
  }
  
  if (validProxies.length === 0) {
    console.log('ℹ️ No hay proxies válidos, usando conexión directa');
    return null;
  }
  
  // Seleccionar proxy aleatorio
  const selectedProxy = validProxies[Math.floor(Math.random() * validProxies.length)];
  console.log(`🔁 Usando proxy: ${selectedProxy.split('@')[1]}`);
  
  try {
    return await proxyChain.anonymizeProxy(`http://${selectedProxy}`);
  } catch (err) {
    console.error('❌ Error al anonimizar proxy:', err.message);
    return `http://${selectedProxy}`;
  }
}

async function humanType(page, selector, text) {
  const element = await page.$(selector);
  if (!element) return false;
  
  await element.click();
  await page.waitForTimeout(300);
  
  for (let i = 0; i < text.length; i++) {
    await element.type(text[i], {
      delay: Math.floor(Math.random() * 100) + 30
    });
    
    if (Math.random() > 0.85 && i < text.length - 1) {
      await page.waitForTimeout(Math.random() * 500 + 100);
    }
  }
  
  return true;
}

async function instagramLogin() {
  const username = process.env.IG_USERNAME;
  const password = process.env.INSTAGRAM_PASS;

  if (!username || !password) {
    throw new Error('Credenciales IG faltantes');
  }

  let proxyUrl;
  try {
    proxyUrl = await getProxy();
  } catch (err) {
    console.error('❌ Error con proxies:', err.message);
    proxyUrl = null;
  }

  const launchOptions = {
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      ...(proxyUrl ? [`--proxy-server=${proxyUrl}`] : [])
    ],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
    ignoreHTTPSErrors: true
  };

  const browser = await puppeteer.launch(launchOptions);
  const page = await browser.newPage();

  // Configuración de detección
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36');
  await page.setExtraHTTPHeaders({ 
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br'
  });

  // Intento 1: Usar cookies existentes
  if (await loadCookies(page)) {
    console.log('✅ Sesión reutilizada desde cookies');
    return { browser, page };
  }

  // Intento 2: Login manual
  console.log('🔐 Iniciando nuevo login...');
  try {
    await page.goto('https://www.instagram.com/accounts/login/', { 
      waitUntil: 'networkidle2', 
      timeout: 45000 
    });

    // Espera dinámica de campos
    await page.waitForSelector('input[name="username"]', { timeout: 15000 });
    
    // Escritura humana
    await humanType(page, 'input[name="username"]', username);
    await humanType(page, 'input[name="password"]', password);
    
    // Interacción humana
    await page.mouse.move(
      Math.random() * 300, 
      Math.random() * 300,
      { steps: 5 }
    );
    await page.waitForTimeout(800);
    
    // Enviar formulario
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 })
    ]);

    // Detectar desafíos
    if (page.url().includes('/challenge')) {
      throw new Error('Instagram solicitó verificación manual');
    }

    // Guardar nuevas cookies
    const cookies = await page.cookies();
    await saveCookies(cookies);
    console.log('🔑 Nuevas cookies guardadas');

    return { browser, page };
  } catch (err) {
    await page.screenshot({ path: 'login-error.png' });
    notifyTelegram(`❌ Error en login: ${err.message}`);
    throw err;
  } finally {
    await page.close();
  }
}

module.exports = { instagramLogin, getCookies, notifyTelegram };
