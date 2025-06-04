Gracias por compartir los logs y el código de referencia a las 01:13 AM CST del 4 de junio de 2025. Los documentos que proporcionaste (mensajes de Google Search y JavaScript no disponible en x.com) sugieren que el problema podría estar relacionado con la detección de bots o la deshabilitación de JavaScript por parte de Instagram o un navegador simulado por Puppeteer, pero los logs que compartiste son más específicos y nos dan una pista clara: el error principal es “❌ La página de login no se cargó correctamente” con el mensaje “Página de login no encontrada”. Esto indica que Puppeteer no está llegando a la página de login esperada de Instagram, y el servidor falla porque todos los intentos de login fallan.
Análisis del Problema
1. Logs Actuales
	•	El proceso inicia correctamente (🟢 Iniciando servidor..., 🚀 Iniciando Puppeteer con Stealth...), y el mensaje de cookies se muestra como ℹ️, lo cual es correcto según el código actualizado.
	•	Sin embargo, al intentar acceder a https://www.instagram.com/accounts/login/, el título de la página es solo “www.instagram.com” en lugar de algo como “Instagram - Log In”, lo que sugiere que la página no carga completamente o redirige a una página diferente (posiblemente una de verificación o error).
	•	Después de 5 intentos, el login falla (❌ Todos los intentos de login fallaron), y el servidor se detiene con ❌ Fallo al iniciar el servidor: Login fallido.
2. Causa Probable
	•	Detección de Bot: Instagram está detectando que Puppeteer es un bot, lo que podría llevar a una página de verificación de JavaScript o CAPTCHA. Esto explicaría por qué el título no coincide con la página de login esperada.
	•	Timeout o Redirección: El timeout de 20 segundos para goto podría no ser suficiente, o la página podría estar redirigiendo a una URL diferente (como una página de bloqueo).
	•	JavaScript Deshabilitado: Los documentos que compartiste sugieren que Instagram requiere JavaScript habilitado, y aunque Puppeteer lo tiene activado por defecto, la configuración podría no ser suficiente para evitar detecciones.
3. Código de Referencia
El código que proporcionaste como funcional tiene diferencias clave:
	•	Usa waitUntil: 'domcontentloaded' en lugar de 'load', lo que podría ser más rápido y evitar esperar recursos pesados.
	•	Incluye referers aleatorios (referers) para simular tráfico humano, lo que podría ayudar a evadir detecciones.
	•	Usa networkidle2 para waitForNavigation, que espera hasta que solo haya 2 conexiones de red, lo que podría ser más robusto para confirmar la navegación.
	•	Almacena cookies por usuario en archivos individuales (e.g., ${username}.json) en lugar de un solo archivo cookie-memory.json.
Estas diferencias podrían estar contribuyendo a que el código anterior funcionara mejor.
Solución
Vamos a combinar lo mejor del código de referencia con las mejoras actuales:
	•	Usar domcontentloaded y networkidle2 para navegación.
	•	Añadir referers aleatorios.
	•	Aumentar timeouts y robustez.
	•	Ajustar la lógica de cookies para usar archivos individuales por usuario, similar al código funcional.
	•	Verificar si JavaScript está funcionando correctamente en la página.
Código Actualizado
`instagramLogin.js`
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
const COOKIE_PATH = path.join(__dirname, 'cookies'); // Cambio a directorio relativo
const referers = [
  'https://www.google.com/search?q=instagram',
  'https://x.com/explore',
  'https://www.facebook.com',
];

// Cache en memoria para cookies y datos scrapeados
let cookieCache = {};
let scrapeCache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hora

// Cargar cookies desde archivo al iniciar
async function loadCookieMemory() {
  try {
    await fs.mkdir(COOKIE_PATH, { recursive: true });
    const files = await fs.readdir(COOKIE_PATH);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const username = file.replace('.json', '');
        const data = await fs.readFile(path.join(COOKIE_PATH, file), 'utf8');
        cookieCache[username] = JSON.parse(data);
        console.log(`✅ Cookie memory cargado para ${username}`);
      }
    }
  } catch (err) {
    console.log(`ℹ️ Cookie memory no encontrado en ${COOKIE_PATH}, inicializando vacío (normal en la primera ejecución)`);
    cookieCache = {};
  }
}

// Guardar cookies en archivo al cerrar
async function saveCookieMemory() {
  try {
    await fs.mkdir(COOKIE_PATH, { recursive: true });
    for (const [username, cookies] of Object.entries(cookieCache)) {
      await fs.writeFile(path.join(COOKIE_PATH, `${username}.json`), JSON.stringify(cookies, null, 2));
      console.log(`✅ Cookie memory guardado para ${username}`);
    }
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
  const userAgent = new UserAgent({ deviceCategory: ['desktop', 'mobile'][Math.floor(Math.random() * 2)] });
  return userAgent.toString();
}

// 🍪 Guardar cookies en memoria y archivo
async function saveCookies(page, username) {
  try {
    const cookies = await page.cookies();
    cookieCache[username] = cookies;
    await fs.writeFile(path.join(COOKIE_PATH, `${username}.json`), JSON.stringify(cookies, null, 2));
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
async function instagramLogin(page, username, encryptedPassword, maxRetries = 5) {
  let delay = 2000; // Retraso inicial de 2 segundos
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔐 Intento de login ${attempt}/${maxRetries} para ${username}`);

      // 🍪 Intenta cargar cookies para evitar login
      const hasCookies = await loadCookies(page, username);
      if (hasCookies) {
        await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 20000 });
        const isLoggedIn = await page.evaluate(() => !!document.querySelector('a[href*="/direct/inbox/"]'));
        if (isLoggedIn) {
          console.log('✅ Sesión activa encontrada, login omitido');
          await saveCookies(page, username);
          return true;
        }
      }

      // Simular tráfico humano con referer
      const referer = referers[Math.floor(Math.random() * referers.length)];
      console.log(`🌐 Visitando referer: ${referer}`);
      await page.goto(referer, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

      // 📲 Accede a la página de login de Instagram
      console.log('🌐 Accediendo a la página de login de Instagram');
      await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'domcontentloaded', timeout: 20000 });
      const pageTitle = await page.title();
      console.log(`Título de la página: ${pageTitle}`);
      if (!pageTitle.includes('Instagram') && !pageTitle.includes('Log In')) {
        console.error('❌ La página de login no se cargó correctamente');
        throw new Error('Página de login no encontrada');
      }

      // Retraso inicial para carga
      await new Promise(resolve => setTimeout(resolve, 3000));

      // 🔍 Verifica si hay un CAPTCHA
      const isCaptcha = await page.evaluate(() => !!document.querySelector('input[name="verificationCode"]'));
      if (isCaptcha) {
        console.warn('⚠️ CAPTCHA detectado, reintentando...');
        delay *= 2;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // Esperar dinámicamente el formulario de login
      console.log('Esperando campos de login...');
      await page.waitForSelector('input[name="username"]', { timeout: 40000 });
      await page.waitForSelector('input[name="password"]', { timeout: 40000 });
      console.log('✅ Campos de login encontrados');

      // Simular movimiento de mouse para parecer humano
      await page.mouse.move(100 + Math.random() * 200, 100 + Math.random() * 200, { steps: 10 });

      // 🔓 Desencripta la contraseña y realiza el login
      const password = decryptPassword(encryptedPassword);
      await page.type('input[name="username"]', username, { delay: 100 + Math.random() * 50 });
      await page.type('input[name="password"]', password, { delay: 100 + Math.random() * 50 });

      await page.click('button[type="submit"]');
      console.log('Formulario enviado, esperando navegación...');
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });

      // ✅ Verifica si el login fue exitoso
      const isLoggedIn = await page.evaluate(() => !!document.querySelector('a[href*="/direct/inbox/"]'));
      if (isLoggedIn) {
        console.log('🚀 Login exitoso');
        await saveCookies(page, username);
        return true;
      }
      console.warn('⚠️ Login fallido, reintentando...');
      delay *= 2;
      await new Promise(resolve => setTimeout(resolve, delay));
    } catch (error) {
      console.error(`❌ Error en login (intento ${attempt}):`, error.message);
      delay *= 2;
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
    if (cachedData && Date.now() - cachedData.timestamp
