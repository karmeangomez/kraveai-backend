const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const COOKIE_PATH = path.join(__dirname, 'instagram_cookies.json');
let cookiesCache = [];

// Configuración centralizada
const CONFIG = {
  loginUrl: 'https://www.instagram.com/accounts/login/',
  userAgents: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
  ],
  browserOptions: {
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process'
    ]
  }
};

/**
 * Desencripta la contraseña usando AES-256-CBC
 */
function decryptPassword() {
  try {
    const key = Buffer.from(process.env.IG_PASSWORD_KEY, 'hex');
    const iv = Buffer.from(process.env.IG_PASSWORD_IV, 'hex');
    
    if (!key.length || !iv.length) throw new Error('Clave o IV inválidos');
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    return decipher.update(process.env.IG_PASSWORD, 'base64', 'utf8') + decipher.final('utf8');
  } catch (error) {
    console.error('[Instagram] Error de desencriptación:', error.message);
    return process.env.IG_PASSWORD; // Fallback
  }
}

/**
 * Manejo de cookies con verificación de expiración
 */
async function handleCookies() {
  try {
    const data = await fs.readFile(COOKIE_PATH, 'utf8');
    cookiesCache = JSON.parse(data);
    
    const sessionCookie = cookiesCache.find(c => c.name === 'sessionid');
    const isValidSession = sessionCookie?.expires > Date.now() / 1000;
    
    if (isValidSession) {
      console.log('[Instagram] Sesión válida encontrada');
      return true;
    }
  } catch (error) {
    console.warn('[Instagram] No se encontraron cookies válidas');
  }
  return false;
}

/**
 * Realiza el proceso de login
 */
async function performLogin(page, username, password) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const userAgent = CONFIG.userAgents[Math.floor(Math.random() * CONFIG.userAgents.length)];
      await page.setUserAgent(userAgent);
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9'
      });

      console.log(`[Instagram] Intento de login #${attempt} con UA: ${userAgent.slice(0, 40)}...`);
      await page.goto(CONFIG.loginUrl, { 
        waitUntil: 'domcontentloaded', 
        timeout: 20000 
      });

      // Esperar elementos críticos
      await Promise.all([
        page.waitForSelector('input[name="username"]', { visible: true, timeout: 10000 }),
        page.waitForSelector('input[name="password"]', { visible: true, timeout: 10000 })
      ]);

      // Rellenar formulario
      await page.type('input[name="username"]', username, { delay: 20 });
      await page.type('input[name="password"]', password, { delay: 20 });

      // Enviar formulario y esperar navegación
      const [response] = await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }),
        page.click('button[type="submit"]')
      ]);

      // Verificar respuesta del servidor
      if (response.status() >= 400) {
        throw new Error(`HTTP ${response.status()}: ${response.statusText()}`);
      }

      // Detectar desafíos de seguridad
      if (page.url().includes('/challenge')) {
        throw new Error('Desafío de seguridad detectado');
      }

      // Verificar login exitoso
      await page.waitForSelector('nav[role="navigation"]', { timeout: 10000 });
      cookiesCache = await page.cookies();
      await fs.writeFile(COOKIE_PATH, JSON.stringify(cookiesCache, null, 2));
      
      console.log('[Instagram] Login exitoso');
      return true;
      
    } catch (error) {
      console.error(`[Instagram] Intento ${attempt} fallido:`, error.message);
      
      // Captura de errores específicos
      const errorElement = await page.$x('//*[contains(text(), "problema") or contains(text(), "error")]');
      if (errorElement.length > 0) {
        const errorText = await page.evaluate(el => el.textContent, errorElement[0]);
        console.error('[Instagram] Error detectado:', errorText.trim());
      }
      
      await new Promise(resolve => setTimeout(resolve, 3000)); // Espera entre intentos
    }
  }
  return false;
}

/**
 * Verifica/realiza login en Instagram
 */
async function ensureLoggedIn() {
  const username = process.env.IG_USERNAME || process.env.IG_USER;
  const password = process.env.IG_PASSWORD_KEY ? decryptPassword() : process.env.IG_PASSWORD;

  if (!username || !password) {
    throw new Error('[Instagram] Credenciales no configuradas en variables de entorno');
  }

  // Verificar sesión existente
  if (await handleCookies()) return;

  console.log('[Instagram] Iniciando nuevo login...');
  const browser = await puppeteer.launch(CONFIG.browserOptions);
  const page = await browser.newPage();
  
  try {
    await page.setViewport({ width: 1280, height: 800 });
    const loginSuccess = await performLogin(page, username, password);
    
    if (!loginSuccess) {
      throw new Error('Todos los intentos de login fallaron');
    }
  } finally {
    await page.close();
    await browser.close();
  }
}

module.exports = {
  ensureLoggedIn,
  getCookies: () => cookiesCache
};
