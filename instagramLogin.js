// ✅ instagramLogin.js - Módulo para login y scraping de Instagram con Puppeteer
const puppeteer = require('puppeteer-extra'); // Usar puppeteer-extra para integrar Stealth
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto'); // Módulo nativo de Node.js para encriptación
const fs = require('fs').promises;
const path = require('path');
const UserAgent = require('user-agents');

// Aplica el plugin de stealth para evitar detección
puppeteer.use(StealthPlugin());

// 🔑 Configuración de encriptación y almacenamiento de cookies
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'mi-clave-secreta-32-bytes-aqui1234';
const COOKIE_PATH = path.join(__dirname, 'cookies');

// 🌐 Lista de referers para simular navegación natural
const referers = [
  'https://www.google.com/search?q=instagram',
  'https://x.com/explore',
  'https://www.facebook.com',
];

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
  const userAgent = new UserAgent({ deviceCategory: ['desktop', 'mobile'][Math.floor(Math.random() * 2)] });
  return userAgent.toString();
}

// 🍪 Guardar cookies para mantener la sesión
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

// 🍪 Cargar cookies para reutilizar la sesión
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

// 🔐 Función para realizar el login en Instagram
async function instagramLogin(page, username, encryptedPassword, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔐 Intento de login ${attempt}/${maxRetries} para ${username}`);

      // 🍪 Intenta cargar cookies para evitar login si ya hay sesión activa
      const hasCookies = await loadCookies(page, username);
      if (hasCookies) {
        await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 15000 });
        const isLoggedIn = await page.evaluate(() => !!document.querySelector('a[href*="/direct/inbox/"]'));
        if (isLoggedIn) {
          console.log('✅ Sesión activa encontrada, login omitido');
          await saveCookies(page, username);
          return true;
        }
      }

      // 🌐 Simula navegación natural visitando un referer aleatorio
      const referer = referers[Math.floor(Math.random() * referers.length)];
      console.log(`🌐 Visitando referer: ${referer}`);
      await page.goto(referer, { waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => {});
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

      // 📲 Accede a la página de login de Instagram
      await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'domcontentloaded', timeout: 15000 });

      // 🔍 Verifica si hay un CAPTCHA
      const isCaptcha = await page.evaluate(() => !!document.querySelector('input[name="verificationCode"]'));
      if (isCaptcha) {
        console.warn('⚠️ CAPTCHA detectado, reintentando...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      }

      // 🔓 Desencripta la contraseña y realiza el login
      const password = decryptPassword(encryptedPassword);
      await page.waitForSelector('input[name="username"]', { timeout: 10000 });
      await page.type('input[name="username"]', username, { delay: 100 + Math.random() * 50 });
      await page.type('input[name="password"]', password, { delay: 100 + Math.random() * 50 });

      await page.click('button[type="submit"]');
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });

      // ✅ Verifica si el login fue exitoso
      const isLoggedIn = await page.evaluate(() => !!document.querySelector('a[href*="/direct/inbox/"]'));
      if (isLoggedIn) {
        console.log('🚀 Login exitoso');
        await saveCookies(page, username);
        return true;
      }
      console.warn('⚠️ Login fallido, reintentando...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    } catch (error) {
      console.error(`❌ Error en login (intento ${attempt}):`, error.message);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  console.error('❌ Todos los intentos de login fallaron');
  return false;
}

// 🔍 Función para realizar scraping de un perfil de Instagram
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

    await page.evaluate(() => window.scrollBy(0, 300 + Math.random() * 100));
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 500));

    // 📊 Extrae los datos del perfil
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

module.exports = { scrapeInstagram, encryptPassword, decryptPassword };
