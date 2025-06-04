// ✅ instagramLogin.js - Módulo optimizado para login y scraping de Instagram con Puppeteer
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const UserAgent = require('user-agents');

puppeteer.use(StealthPlugin());

// 🔑 Configuración de encriptación y almacenamiento de cookies
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'mi-clave-secreta-32-bytes-aqui1234';
const COOKIE_PATH = process.env.COOKIE_PATH || '/tmp/cookies';
const COOKIE_MEMORY_PATH = path.join(COOKIE_PATH, 'cookie-memory.json');

// Cache en memoria para cookies y datos scrapeados
let cookieCache = {};
let scrapeCache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hora

// Cargar cookies desde archivo al iniciar
async function loadCookieMemory() {
  try {
    await fs.mkdir(COOKIE_PATH, { recursive: true }); // Asegurar que el directorio exista
    const data = await fs.readFile(COOKIE_MEMORY_PATH, 'utf8');
    cookieCache = JSON.parse(data);
    console.log('✅ Cookie memory cargado desde archivo');
  } catch (err) {
    console.log(`ℹ️ Cookie memory no encontrado en ${COOKIE_MEMORY_PATH}, inicializando vacío (normal en la primera ejecución)`);
    cookieCache = {};
  }
}

// Guardar cookies en archivo al cerrar
async function saveCookieMemory() {
  try {
    await fs.mkdir(COOKIE_PATH, { recursive: true });
    await fs.writeFile(COOKIE_MEMORY_PATH, JSON.stringify(cookieCache, null, 2));
    console.log('✅ Cookie memory guardado en archivo');
  } catch (err) {
    console.error('❌ Error al guardar cookie memory:', err.message);
  }
}

// 🔒 Función para encriptar la contraseña
function encryptPassword(password) {
  const iv = Buffer.from(crypto.randomBytes(16));
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(password, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return { iv: iv.toString('hex'), encryptedData: encrypted };
}

// 🔓 Función para desencriptar la contraseña
function decryptPassword(encryptedObj) {
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), Buffer.from(encryptedObj.iv, 'hex'));
  let decrypted = decipher.update(encryptedObj.encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// 🌐 Generar un User-Agent aleatorio
function getNextUserAgent() {
  const userAgent = new UserAgent({ deviceCategory: 'desktop' });
  return userAgent.toString();
}

// 🍪 Guardar cookies en memoria y archivo
async function saveCookies(page, username) {
  try {
    const cookies = await page.cookies();
    cookieCache[username] = cookies;
    await saveCookieMemory();
    console.log(`✅ Cookies guardadas para ${username} en memoria y archivo`);
    return true;
  } catch (err) {
    console.error(`❌ Error al guardar cookies para ${username}:`, err.message);
    return false;
  }
}

// 🍪 Cargar cookies desde memoria
async function loadCookies(page, username) {
  try {
    if (cookieCache[username]) {
      await page.setCookie(...cookieCache[username]);
      console.log(`✅ Cookies cargadas para ${username} desde memoria`);
      return true;
    }
    console.log(`ℹ️ No se encontraron cookies en memoria para ${username}, intentando login`);
    return false;
  } catch (err) {
    console.error(`❌ Error al cargar cookies para ${username}:`, err.message);
    return false;
  }
}

// 🔐 Función para realizar el login en Instagram con backoff exponencial
async function instagramLogin(page, username, encryptedPassword, maxRetries = 5) { // Aumentamos a 5 intentos
  let delay = 2000; // Retraso inicial de 2 segundos
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔐 Intento de login ${attempt}/${maxRetries} para ${username}`);

      // 🍪 Intenta cargar cookies para evitar login
      const hasCookies = await loadCookies(page, username);
      if (hasCookies) {
        await page.goto('https://www.instagram.com/', { waitUntil: 'load', timeout: 20000 });
        const isLoggedIn = await page.evaluate(() => !!document.querySelector('a[href*="/direct/inbox/"]'));
        if (isLoggedIn) {
          console.log('✅ Sesión activa encontrada, login omitido');
          return true;
        }
      }

      // 📲 Accede a la página de login de Instagram
      console.log('🌐 Accediendo a la página de login de Instagram');
      await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'load', timeout: 20000 });
      const pageTitle = await page.title();
      console.log(`Título de la página: ${pageTitle}`);
      if (!pageTitle.includes('Instagram')) {
        console.error('❌ La página de login no se cargó correctamente');
        throw new Error('Página de login no encontrada');
      }

      // Retraso inicial para carga
      await new Promise(resolve => setTimeout(resolve, 3000));

      // 🔍 Verifica si hay un CAPTCHA o página cargada
      const isCaptcha = await page.evaluate(() => !!document.querySelector('input[name="verificationCode"]'));
      if (isCaptcha) {
        console.warn('⚠️ CAPTCHA detectado, reintentando...');
        delay *= 2; // Backoff exponencial
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // Esperar dinámicamente el formulario de login
      console.log('Esperando campos de login...');
      await page.waitForFunction(
        () => document.querySelector('input[name="username"]') && document.querySelector('input[name="password"]'),
        { timeout: 40000 } // Aumentado a 40 segundos
      );
      console.log('✅ Campos de login encontrados');

      // Simular movimiento de mouse para parecer humano
      await page.mouse.move(100 + Math.random() * 200, 100 + Math.random() * 200, { steps: 10 });

      // 🔓 Desencripta la contraseña y realiza el login
      const password = decryptPassword(encryptedPassword);
      await page.type('input[name="username"]', username, { delay: 50 + Math.random() * 20 });
      await page.type('input[name="password"]', password, { delay: 50 + Math.random() * 20 });

      await page.click('button[type="submit"]');
      console.log('Formulario enviado, esperando navegación...');
      await page.waitForNavigation({ waitUntil: 'load', timeout: 20000 });

      // ✅ Verifica si el login fue exitoso
      const isLoggedIn = await page.evaluate(() => !!document.querySelector('a[href*="/direct/inbox/"]'));
      if (isLoggedIn) {
        console.log('🚀 Login exitoso');
        const saved = await saveCookies(page, username);
        if (saved) {
          console.log('✅ Cookies confirmadas como guardadas');
        } else {
          console.warn('⚠️ Cookies no guardadas correctamente');
        }
        return true;
      }
      console.warn('⚠️ Login fallido, reintentando...');
      delay *= 2; // Backoff exponencial
      await new Promise(resolve => setTimeout(resolve, delay));
    } catch (error) {
      console.error(`❌ Error en login (intento ${attempt}):`, error.message);
      delay *= 2; // Backoff exponencial
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  console.error('❌ Todos los intentos de login fallaron');
  return false;
}

// 🔍 Función para realizar scraping de un perfil de Instagram
async function scrapeInstagram(page, username, encryptedPassword) {
  try {
    console.log(`🔍 Scraping perfil de Instagram: ${username}`);

    // Verificar cache de scraping
    const cachedData = scrapeCache.get(username);
    if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL) {
      console.log('✅ Datos obtenidos desde cache');
      return cachedData.data;
    }

    const loginSuccess = await instagramLogin(page, username, encryptedPassword);
    if (!loginSuccess) {
      console.log('❌ Fallo en login, deteniendo scraping');
      return null;
    }

    await page.goto(`https://www.instagram.com/${username}/`, { waitUntil: 'load', timeout: 20000 });

    await page.waitForFunction(
      () => document.querySelector('img[alt*="profile picture"]') || document.querySelector('h1'),
      { timeout: 15000 }
    );

    await page.evaluate(() => window.scrollBy(0, 100 + Math.random() * 50));
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 200));

    const data = await page.evaluate(() => {
      return {
        username: document.querySelector('h1')?.textContent || '',
        profile_pic_url: document.querySelector('img[alt*="profile picture"]')?.src || '',
        followers_count: document.querySelector('header section ul li:nth-child(2) span')?.textContent || '0',
        is_verified: !!document.querySelector('header section svg[aria-label="Verified"]'),
      };
    });

    // Guardar en cache
    scrapeCache.set(username, { data, timestamp: Date.now() });
    console.log('✅ Datos obtenidos y guardados en cache:', data);
    return data;
  } catch (error) {
    console.error('❌ Error en scraping:', error.message);
    return null;
  }
}

// Inicializar cookie memory al cargar el módulo
loadCookieMemory();

// Guardar cookie memory al cerrar el proceso
process.on('SIGTERM', saveCookieMemory);
process.on('SIGINT', saveCookieMemory);

module.exports = { scrapeInstagram, encryptPassword, decryptPassword };
