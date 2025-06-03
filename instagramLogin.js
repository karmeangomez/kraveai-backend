const fs = require('fs').promises;
const path = require('path');
const UserAgent = require('user-agents');
const db = require('./lib/firebase'); // Para Firestore
const crypto = require('crypto'); // Para cifrado

const cookiesDir = path.join(__dirname, 'cookies');
const LOGIN_TIMEOUT = 120000; // 2 minutos para login crítico
const NAVIGATION_TIMEOUT = 60000; // 1 minuto
const SESSION_CHECK_THRESHOLD = 86400000; // 24 horas antes de verificar
const INACTIVITY_THRESHOLD = 172800000; // 48 horas para inactividad
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'mi-clave-secreta-32-bytes-aqui1234'; // Usa una clave segura de 32 bytes

const humanBehavior = {
  randomDelay: (min = 1000, max = 5000) =>
    new Promise(resolve => setTimeout(resolve, min + Math.random() * (max - min))),
  randomType: async (page, selector, text) => {
    for (let char of text) {
      await page.type(selector, char, { delay: 70 + Math.random() * 100 });
      await humanBehavior.randomDelay(150, 400);
    }
  },
  randomScroll: async (page) => {
    const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
    for (let i = 0; i < 3; i++) {
      await page.evaluate((h) => window.scrollBy(0, h * Math.random()), scrollHeight);
      await humanBehavior.randomDelay(1000, 3000);
    }
  }
};

let cachedSession = null;

// Funciones de cifrado
function encrypt(data) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return { iv: iv.toString('hex'), encryptedData: encrypted };
}

function decrypt(encryptedObj) {
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), Buffer.from(encryptedObj.iv, 'hex'));
  let decrypted = decipher.update(encryptedObj.encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return JSON.parse(decrypted);
}

async function instagramLogin(page, username, password, cookiesFile = 'default') {
  const sessionKey = `${username}_${cookiesFile}`;
  const cookiesPath = path.join(cookiesDir, `${sessionKey}.json`);
  const backupPath = path.join(cookiesDir, `${sessionKey}_backup_${Date.now()}.json`);

  try {
    console.log(`🔍 Revisando sesión para: ${username} (${sessionKey}) [${new Date().toISOString()}]`);
    await fs.mkdir(cookiesDir, { recursive: true });

    // Usar sesión en caché si está reciente y válida
    if (cachedSession && cachedSession.username === username && Date.now() - cachedSession.lastChecked < SESSION_CHECK_THRESHOLD) {
      await page.setCookie(...cachedSession.cookies);
      console.log(`🍪 Usando sesión en caché para ${sessionKey}`);
      const sessionActive = await verifySession(page);
      if (sessionActive) {
        cachedSession.lastActivity = Date.now();
        console.log(`✅ Sesión activa desde caché para ${sessionKey}`);
        return true;
      }
    }

    // Cargar cookies desde disco, respaldo o Firestore
    let cookies = await loadValidCookies(cookiesPath, backupPath, username);
    if (cookies.length > 0) {
      await page.setCookie(...cookies);
      console.log(`🍪 Cookies cargadas para ${sessionKey}`);
    }

    // Verificar y mantener sesión activa
    const sessionActive = await verifySession(page);
    if (sessionActive) {
      cachedSession = { username, cookies, lastChecked: Date.now(), lastActivity: Date.now() };
      console.log(`✅ Sesión activa detectada y/o restaurada para ${sessionKey}`);
      await saveSession(cookiesPath, cookies); // Guardar en disco
      return true;
    }

    console.warn(`⚠️ Sesión inválida para ${sessionKey}, intentando login`);

    // Login completo con reintentos
    for (let attempt = 1; attempt <= 3; attempt++) {
      console.log(`🔐 Iniciando login (intento ${attempt}/3) para ${sessionKey}...`);
      await page.goto('https://www.instagram.com/accounts/login/', {
        waitUntil: 'domcontentloaded',
        timeout: NAVIGATION_TIMEOUT
      });

      const isChallenge = await handleChallenge(page);
      if (isChallenge && attempt < 3) {
        console.warn("🚧 Detectado desafío, reintentando...");
        await humanBehavior.randomDelay(30000, 60000); // Pausa larga
        continue;
      }

      await page.waitForSelector('input[name="username"]', { visible: true, timeout: 20000 });

      const ua = new UserAgent({ deviceCategory: 'mobile' }).toString();
      await page.setUserAgent(ua);
      console.log(`📱 User-Agent: ${ua}`);

      await humanBehavior.randomType(page, 'input[name="username"]', username);
      await humanBehavior.randomDelay(1500, 3000);
      await humanBehavior.randomType(page, 'input[name="password"]', password);
      await humanBehavior.randomDelay(1500, 3000);

      await page.click('button[type="submit"]');

      const loginSuccess = await Promise.race([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: LOGIN_TIMEOUT }),
        humanBehavior.randomDelay(10000, 15000)
      ]).then(() => true).catch(() => false);

      if (loginSuccess) {
        const error = await page.$('#slfErrorAlert');
        if (error) {
          const msg = await page.$eval('#slfErrorAlert', el => el.textContent);
          console.error("❌ Error en login:", msg);
          if (attempt === 3) return false;
          await humanBehavior.randomDelay(30000, 60000);
          continue;
        }

        await handlePostLoginModals(page);

        const newCookies = await page.cookies();
        cachedSession = { username, cookies: newCookies, lastChecked: Date.now(), lastActivity: Date.now() };
        await saveSession(cookiesPath, newCookies); // Guardar en disco
        await saveToFirestore(username, newCookies); // Guardar en Firestore
        console.log(`✅ Login exitoso y cookies guardadas para ${sessionKey}`);
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error(`❌ Fallo durante login para ${sessionKey}:`, error.message);
    return false;
  }
}

// Verificar sesión
async function verifySession(page) {
  try {
    const response = await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle0', timeout: NAVIGATION_TIMEOUT });
    if (response.status() >= 400) {
      console.warn(`⚠️ Código de estado HTTP: ${response.status()}`);
      return false;
    }
    const isActive = await page.evaluate(() => {
      return document.querySelector('svg[aria-label="Inicio"]') !== null;
    });
    if (isActive && Date.now() - cachedSession?.lastActivity > INACTIVITY_THRESHOLD) {
      await humanBehavior.randomScroll(page); // Simular actividad mínima
      cachedSession.lastActivity = Date.now();
      console.log("🖱️ Actividad simulada para mantener sesión viva");
    }
    return isActive;
  } catch (e) {
    console.warn("⚠️ Error al verificar sesión:", e.message);
    return false;
  }
}

// Manejar desafíos
async function handleChallenge(page) {
  const isChallenge = await page.waitForFunction(() => window.location.href.includes('challenge'), { timeout: 20000 })
    .then(() => true).catch(() => false);
  if (isChallenge) {
    const challengeType = await page.evaluate(() => document.body.innerText.toLowerCase());
    if (challengeType.includes('verifica') || challengeType.includes('sospechosa') || challengeType.includes('captcha')) {
      console.error("🚧 Desafío detectado: pausa manual requerida");
      await humanBehavior.randomDelay(60000, 120000); // Pausa larga
      return true;
    }
  }
  return false;
}

// Manejar modales post-login
async function handlePostLoginModals(page) {
  try {
    const modals = [
      '//button[contains(., "Ahora no") or contains(., "Not Now")]',
      '//button[contains(., "Denegar") or contains(., "Decline")]'
    ];
    for (const xpath of modals) {
      const elements = await page.$x(xpath);
      if (elements.length > 0) {
        await elements[0].click();
        console.log("🧼 Cerrado modal post-login");
        await humanBehavior.randomDelay(1000, 2000);
      }
    }
  } catch (e) {
    console.log("ℹ️ No se encontraron modales post-login");
  }
}

// Guardar sesión en disco (cifrada)
async function saveSession(cookiesPath, cookies) {
  const encryptedCookies = encrypt(cookies);
  await fs.writeFile(cookiesPath, JSON.stringify(encryptedCookies, null, 2));
  console.log("💾 Sesión guardada en disco (cifrada)");
}

// Guardar sesión en Firestore (cifrada)
async function saveToFirestore(username, cookies) {
  if (db) {
    const encryptedCookies = encrypt(cookies);
    await db.collection('instagram_sessions').doc(username).set({
      cookies: encryptedCookies,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    console.log("☁️ Sesión guardada en Firestore (cifrada)");
  }
}

// Cargar cookies válidas
async function loadValidCookies(cookiesPath, backupPath, username) {
  let cookies = [];

  // Leer cookies desde archivo principal
  if (await fs.access(cookiesPath).then(() => true).catch(() => false)) {
    try {
      const encryptedCookies = JSON.parse(await fs.readFile(cookiesPath, 'utf8'));
      cookies = decrypt(encryptedCookies);
      console.log("📂 Cookies cargadas desde archivo local (descifradas)");
      if (await validateCookies(cookies)) return cookies;
      console.warn("⚠️ Cookies locales inválidas, intentando respaldo o Firestore");
    } catch (e) {
      console.warn("⚠️ Archivo local corrupto, intentando respaldo o Firestore");
    }
  }

  // Leer desde backup si existe
  if (await fs.access(backupPath).then(() => true).catch(() => false)) {
    try {
      const encryptedCookies = JSON.parse(await fs.readFile(backupPath, 'utf8'));
      cookies = decrypt(encryptedCookies);
      console.log("♻️ Cookies restauradas desde respaldo (descifradas)");
      if (await validateCookies(cookies)) {
        await saveSession(cookiesPath, cookies);
        return cookies;
      }
      console.warn("⚠️ Cookies de respaldo inválidas, intentando Firestore");
    } catch (e) {
      console.warn("⚠️ Respaldo corrupto, intentando Firestore");
    }
  }

  // Leer desde Firestore si existe
  if (db && username) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const ref = db.collection('instagram_sessions').doc(username);
        const doc = await ref.get();
        if (doc.exists) {
          const encryptedCookies = doc.data().cookies || {};
          cookies = decrypt(encryptedCookies);
          console.log("☁️ Cookies recuperadas desde Firestore (descifradas)");
          if (await validateCookies(cookies)) {
            await saveSession(cookiesPath, cookies); // Guardar local
            return cookies;
          }
          console.warn("⚠️ Cookies de Firestore inválidas");
        } else {
          console.warn("⚠️ No hay cookies guardadas en Firestore");
        }
        break; // Si llegamos aquí sin errores, salimos del bucle
      } catch (err) {
        console.error(`❌ Error al recuperar cookies desde Firestore (intento ${attempt}/3):`, err.message);
        if (attempt === 3) break;
        await humanBehavior.randomDelay(5000, 10000); // Pausa antes de reintentar
      }
    }
  }

  console.log("ℹ️ No se encontraron cookies válidas, se iniciará login");
  return [];
}

// Validar cookies
async function validateCookies(cookies) {
  if (!Array.isArray(cookies) || cookies.length === 0) return false;
  const sessionCookie = cookies.find(cookie => cookie.name === 'sessionid');
  if (!sessionCookie) return false;
  // Verificar si la cookie no está expirada
  if (sessionCookie.expires && sessionCookie.expires * 1000 < Date.now()) {
    console.warn("⚠️ Cookie 'sessionid' expirada");
    return false;
  }
  return true;
}

module.exports = { instagramLogin };
