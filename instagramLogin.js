// ✅ instagramLogin.js - Módulo ultraoptimizado para login y scraping de Instagram con Puppeteer
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const UserAgent = require('user-agents');

// Configuración global para cookies en memoria
const inMemoryCookies = new Map();

puppeteer.use(StealthPlugin());

// 🔑 Configuración de encriptación y almacenamiento de cookies
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'mi-clave-secreta-32-bytes-aqui1234';
const COOKIE_PATH = process.env.COOKIE_PATH || '/tmp/cookies';

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
  return new UserAgent({ deviceCategory: ['desktop', 'mobile'][Math.floor(Math.random() * 2)] }).toString();
}

// 🍪 Guardar cookies en archivo y memoria
async function saveCookies(page, username) {
  try {
    await fs.mkdir(COOKIE_PATH, { recursive: true });
    const cookies = await page.cookies();
    const cookieFile = path.join(COOKIE_PATH, `${username}-cookies.json`);
    await fs.writeFile(cookieFile, JSON.stringify(cookies, null, 2));
    inMemoryCookies.set(username, cookies); // Guardar en memoria
    console.log(`✅ Cookies guardadas para ${username} en ${cookieFile} y memoria`);
    return true;
  } catch (err) {
    console.error(`❌ Error al guardar cookies para ${username}:`, err.message);
    return false;
  }
}

// 🍪 Cargar cookies desde archivo o memoria
async function loadCookies(page, username) {
  try {
    const cachedCookies = inMemoryCookies.get(username);
    if (cachedCookies) {
      await page.setCookie(...cachedCookies);
      console.log(`✅ Cookies cargadas desde memoria para ${username}`);
      return true;
    }

    const cookieFile = path.join(COOKIE_PATH, `${username}-cookies.json`);
    const cookiesString = await fs.readFile(cookieFile, 'utf8');
    const cookies = JSON.parse(cookiesString);
    await page.setCookie(...cookies);
    inMemoryCookies.set(username, cookies); // Actualizar memoria
    console.log(`✅ Cookies cargadas desde ${cookieFile} para ${username}`);
    return true;
  } catch (err) {
    console.warn(`⚠️ No se encontraron cookies para ${username}:`, err.message);
    return false;
  }
}

// 🔐 Función para realizar el login en Instagram
async function instagramLogin(page, username, encryptedPassword, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔐 Intento de login ${attempt}/${maxRetries} para ${username}`);

      const hasCookies = await loadCookies(page, username);
      if (hasCookies) {
        await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle0', timeout: 15000 });
        const isLoggedIn = await page.evaluate(() => !!document.querySelector('a[href*="/direct/inbox/"]'));
        if (isLoggedIn) {
          console.log('✅ Sesión activa encontrada, login omitido');
          return true;
        }
      }

      console.log('🌐 Accediendo a la página de login de Instagram');
      await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle0', timeout: 20000 });

      // Simular interacción humana
      await page.evaluate(() => {
        window.scrollBy(0, 100);
        document.dispatchEvent(new Event('mousemove'));
      });

      // Esperar dinámicamente el formulario
      await page.waitForFunction(
        () => document.querySelector('input[name="username"]') && document.querySelector('input[name="password"]'),
        { timeout: 20000 }
      );

      const password = decryptPassword(encryptedPassword);
      await page.type('input[name="username"]', username, { delay: 30 });
      await page.type('input[name="password"]', password, { delay: 30 });

      await page.click('button[type="submit"]');
      await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 20000 });

      const isLoggedIn = await page.evaluate(() => !!document.querySelector('a[href*="/direct/inbox/"]'));
      if (isLoggedIn) {
        console.log('🚀 Login exitoso');
        await saveCookies(page, username);
        return true;
      }
      console.warn('⚠️ Login fallido, reintentando...');
      await page.reload({ waitUntil: 'networkidle0', timeout: 15000 }); // Recargar antes de reintentar
    } catch (error) {
      console.error(`❌ Error en login (intento ${attempt}):`, error.message);
      if (attempt < maxRetries) await new Promise(resolve => setTimeout(resolve, 2000));
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

    await page.goto(`https://www.instagram.com/${username}/`, { waitUntil: 'networkidle0', timeout: 15000 });

    await page.waitForFunction(
      () => document.querySelector('img[alt*="profile picture"]') || document.querySelector('h1'),
      { timeout: 10000 }
    );

    await page.evaluate(() => window.scrollBy(0, 100));
    await new Promise(resolve => setTimeout(resolve, 300));

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
