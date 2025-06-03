const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

puppeteer.use(StealthPlugin());

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'mi-clave-secreta-32-bytes-aqui1234';
const COOKIE_PATH = path.join(__dirname, 'cookies');

const proxies = [
  '198.23.239.134:6540:pdsmombq:terqdq67j6mp',
  '207.244.217.165:6712:pdsmombq:terqdq67j6mp',
  '107.172.163.27:6543:pdsmombq:terqdq67j6mp',
  '161.123.152.115:6360:pdsmombq:terqdq67j6mp',
  '23.94.138.75:6349:pdsmombq:terqdq67j6mp',
  '216.10.27.159:6837:pdsmombq:terqdq67j6mp',
  '136.0.207.84:6661:pdsmombq:terqdq67j6mp',
  '64.64.118.149:6732:pdsmombq:terqdq67j6mp',
  '142.147.128.93:6593:pdsmombq:terqdq67j6mp',
  '154.36.110.199:6853:pdsmombq:terqdq67j6mp',
];
let proxyIndex = 0;

const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/118.0',
];

const referers = [
  'https://www.google.com/search',
  'https://twitter.com/explore',
  'https://facebook.com',
];

// 🔐 Encriptar y desencriptar contraseña
function encryptPassword(password) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(password, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return { iv: iv.toString('hex'), encryptedData: encrypted };
}

function decryptPassword(encryptedObj) {
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), Buffer.from(encryptedObj.iv, 'hex'));
  let decrypted = decipher.update(encryptedObj.encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// 🛜 Validar y obtener próximo proxy
async function validateProxy(proxy) {
  try {
    const [host, port, username, password] = proxy.split(':');
    const response = await axios.get('https://www.google.com', {
      proxy: { host, port: parseInt(port), auth: { username, password } },
      timeout: 5000,
    });
    return response.status === 200;
  } catch {
    return false;
  }
}

async function getNextProxy() {
  for (let i = 0; i < proxies.length; i++) {
    const proxy = proxies[proxyIndex];
    proxyIndex = (proxyIndex + 1) % proxies.length;
    if (await validateProxy(proxy)) {
      console.log(`🛜 Proxy válido: ${proxy}`);
      return proxy;
    }
    console.warn(`⚠️ Proxy inválido: ${proxy}`);
  }
  console.warn('⚠️ No hay proxies válidos disponibles');
  return '';
}

// 🎲 Obtener User-Agent aleatorio
function getNextUserAgent() {
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

// 📦 Guardar y cargar cookies desde archivo
async function saveCookies(page, username) {
  try {
    const cookies = await page.cookies();
    await fs.mkdir(COOKIE_PATH, { recursive: true });
    await fs.writeFile(path.join(COOKIE_PATH, `${username}.json`), JSON.stringify(cookies, null, 2));
    console.log(`✅ Cookies guardadas para ${username}`);
  } catch (err) {
    console.error(`❌ Error al guardar cookies para ${username}:`, err.message);
  }
}

async function loadCookies(page, username) {
  try {
    const cookieFile = path.join(COOKIE_PATH, `${username}.json`);
    const cookiesString = await fs.readFile(cookieFile, 'utf8');
    const cookies = JSON.parse(cookiesString);
    await page.setCookie(...cookies);
    console.log(`✅ Cookies cargadas para ${username}`);
    return true;
  } catch {
    console.warn(`⚠️ No se encontraron cookies para ${username}`);
    return false;
  }
}

// 🚀 Inicialización de Puppeteer
async function initBrowser() {
  try {
    console.log('🚀 Iniciando Puppeteer con Stealth y Proxy...');
    const proxy = await getNextProxy();
    if (!proxy) throw new Error('No hay proxies válidos');

    const [host, port, username, password] = proxy.split(':');
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        '--enable-javascript',
        '--window-size=1920,1080',
        `--proxy-server=http://${host}:${port}`,
      ],
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();
    const ua = getNextUserAgent();
    await page.setUserAgent(ua);
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    });
    await page.setViewport({ width: 1920, height: 1080 });

    // Evitar detección de bot
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      window.navigator.chrome = { runtime: {} };
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
    });

    // Autenticar proxy
    if (username && password) {
      await page.authenticate({ username, password });
    }

    console.log(`✅ Navegador listo con proxy: ${host}:${port}, UA: ${ua}`);
    return { browser, page };
  } catch (err) {
    console.error('❌ Error al iniciar Puppeteer:', err.message);
    return null;
  }
}

// 🔐 Login en Instagram
async function instagramLogin(page, username, encryptedPassword, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔐 Intento de login ${attempt}/${maxRetries} para ${username}`);

      // Cargar cookies existentes
      const hasCookies = await loadCookies(page, username);
      if (hasCookies) {
        await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded' });
        const isLoggedIn = await page.evaluate(() => !!document.querySelector('a[href*="/direct/inbox/"]'));
        if (isLoggedIn) {
          console.log('✅ Sesión activa encontrada, login omitido');
          await saveCookies(page, username);
          return true;
        }
      }

      // Simular tráfico humano
      const referer = referers[Math.floor(Math.random() * referers.length)];
      console.log(`🌐 Visitando referer: ${referer}`);
      await page.goto(referer, { waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => {});

      await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'domcontentloaded', timeout: 15000 });

      // Verificar si hay CAPTCHA
      const isCaptcha = await page.evaluate(() => !!document.querySelector('input[name="verificationCode"]'));
      if (isCaptcha) {
        console.warn('⚠️ CAPTCHA detectado, reintentando con nuevo proxy...');
        return false;
      }

      const password = decryptPassword(encryptedPassword);
      await page.waitForSelector('input[name="username"]', { timeout: 10000 });
      await page.type('input[name="username"]', username, { delay: 100 + Math.random() * 50 });
      await page.type('input[name="password"]', password, { delay: 100 + Math.random() * 50 });

      await page.click('button[type="submit"]');
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });

      // Verificar login exitoso
      const isLoggedIn = await page.evaluate(() => !!document.querySelector('a[href*="/direct/inbox/"]'));
      if (isLoggedIn) {
        console.log('🚀 Login exitoso');
        await saveCookies(page, username);
        return true;
      }
      console.warn('⚠️ Login fallido, reintentando...');
    } catch (error) {
      console.error(`❌ Error en login (intento ${attempt}):`, error.message);
    }
  }
  console.error('❌ Todos los intentos de login fallaron');
  return false;
}

// 🔍 Scraping de datos de perfil
async function scrapeInstagram(page, username, encryptedPassword) {
  try {
    console.log(`🔍 Scraping perfil de Instagram: ${username}`);
    const loginSuccess = await instagramLogin(page, username, encryptedPassword);
    if (!loginSuccess) {
      console.log('❌ Fallo en login, deteniendo scraping');
      return null;
    }

    await page.goto(`https://www.instagram.com/${username}/`, { waitUntil: 'domcontentloaded', timeout: 15000 });

    await page.waitForFunction(
      () => document.querySelector('img[alt*="profile picture"]') || document.querySelector('h1'),
      { timeout: 10000 }
    );

    // Simular comportamiento humano
    await page.evaluate(() => window.scrollBy(0, 300 + Math.random() * 100));
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 500));

    const data = await page.evaluate(() => {
      return {
        username: document.querySelector('h1')?.textContent || '',
        profile_pic_url: document.querySelector('img[alt*="profile picture"]')?.src || '',
        followers_count: document.querySelector('header section ul li:nth-child(2) span')?.textContent || '0',
        is_verified: !!document.querySelector('header section svg[aria-label="Verified"]'),
      };
    });

    console.log('✅ Datos obtenidos:', data);
    return data;
  } catch (error) {
    console.error('❌ Error en scraping:', error.message);
    return null;
  }
}

// 🎯 Exportar funciones
module.exports = { scrapeInstagram, encryptPassword };
