const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs').promises;

puppeteer.use(StealthPlugin());

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'mi-clave-secreta-32-bytes-aqui1234';
const proxies = [
  "198.23.239.134:6540:pdsmombq:terqdq67j6mp",
  "207.244.217.165:6712:pdsmombq:terqdq67j6mp",
  "107.172.163.27:6543:pdsmombq:terqdq67j6mp",
  "161.123.152.115:6360:pdsmombq:terqdq67j6mp",
  "23.94.138.75:6349:pdsmombq:terqdq67j6mp",
  "216.10.27.159:6837:pdsmombq:terqdq67j6mp",
  "136.0.207.84:6661:pdsmombq:terqdq67j6mp",
  "64.64.118.149:6732:pdsmombq:terqdq67j6mp",
  "142.147.128.93:6593:pdsmombq:terqdq67j6mp",
  "154.36.110.199:6853:pdsmombq:terqdq67j6mp"
];
let proxyIndex = 0;

// 🔐 Funciones de encriptado y desencriptado
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

// 🛜 Obtener próximo proxy
function getNextProxy() {
  const proxy = proxies[proxyIndex] || '';
  proxyIndex = (proxyIndex + 1) % proxies.length;
  return proxy;
}

// 🚀 Inicialización de Puppeteer con proxy y stealth
async function initBrowser() {
  try {
    console.log("🚀 Iniciando Puppeteer con Stealth y Proxy...");
    const proxy = getNextProxy();
    console.log(`🛜 Usando proxy: ${proxy}`);

    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        `--proxy-server=http://${proxy}`
      ],
      ignoreHTTPSErrors: true
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.4472.114 Safari/537.36');

    console.log("✅ Navegador listo con proxy");
    return { browser, page };
  } catch (err) {
    console.error("❌ Error al iniciar Puppeteer:", err.message);
    return null;
  }
}

// 🔐 Login en Instagram con desencriptado de contraseña
async function instagramLogin(page, username, encryptedPassword) {
  try {
    console.log(`🔐 Iniciando sesión en Instagram: ${username}`);
    
    await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'domcontentloaded' });

    const password = decryptPassword(encryptedPassword);
    console.log("✅ Contraseña desencriptada correctamente");

    await page.type('input[name="username"]', username, { delay: 100 });
    await page.type('input[name="password"]', password, { delay: 100 });

    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 });

    console.log("🚀 Login exitoso");
    return true;
  } catch (error) {
    console.error("❌ Error en login:", error.message);
    return false;
  }
}

// 🔍 Scraping de datos de perfil de Instagram
async function scrapeInstagram(username, encryptedPassword) {
  const { browser, page } = await initBrowser();
  if (!browser) return null;

  try {
    console.log(`🔍 Accediendo a Instagram: ${username}`);
    const loginSuccess = await instagramLogin(page, username, encryptedPassword);
    if (!loginSuccess) {
      console.log("❌ Fallo en login, deteniendo scraping.");
      await browser.close();
      return null;
    }

    await page.goto(`https://www.instagram.com/${username}/`, { timeout: 60000, waitUntil: 'domcontentloaded' });

    await page.waitForFunction(() => document.querySelector('img[alt*="profile picture"]'), { timeout: 30000 });

    await page.evaluate(() => window.scrollBy(0, 300));

    const data = await page.evaluate(() => {
      return {
        username: document.querySelector('h1')?.textContent || "",
        profile_pic_url: document.querySelector('img[alt*="profile picture"]')?.src || "",
        followers_count: document.querySelector('header section ul li:nth-child(2) span')?.textContent || "",
        is_verified: !!document.querySelector('header section svg[aria-label="Verified"]')
      };
    });

    console.log("✅ Datos obtenidos:", data);
    await browser.close();
    return data;
  } catch (error) {
    console.error("❌ Error en scraping:", error.message);
    await browser.close();
    return null;
  }
}

// 🔐 Ejemplo de uso con encriptado
const storedPassword = encryptPassword("tu_contraseña_secreta"); // Guarda esto en la BD
const result = await scrapeInstagram("tu_usuario", storedPassword);
console.log("🎯 Resultado final:", result);
