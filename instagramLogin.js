const fs = require('fs').promises;
const path = require('path');
const UserAgent = require('user-agents');
const db = require('./lib/firebase'); // Firestore activo

const cookiesDir = path.join(__dirname, 'cookies');
const LOGIN_TIMEOUT = 120000;
const NAVIGATION_TIMEOUT = 60000;

const humanBehavior = {
  randomDelay: (min = 1000, max = 5000) =>
    new Promise(resolve => setTimeout(resolve, min + Math.random() * (max - min))),
  randomType: async (page, selector, text) => {
    for (let char of text) {
      await page.type(selector, char, { delay: 70 + Math.random() * 100 });
      await humanBehavior.randomDelay(150, 400);
    }
  }
};

async function instagramLogin(page, username, password, cookiesFile = 'default') {
  const cookiesPath = path.join(cookiesDir, `${cookiesFile}.json`);

  try {
    console.log(`🔍 Revisando sesión para: ${username}`);
    await fs.mkdir(cookiesDir, { recursive: true });

    // ⬇️ Intentar cargar cookies desde Firestore
    const firestoreCookies = await loadFromFirestore(username);
    if (firestoreCookies.length > 0) {
      await page.setCookie(...firestoreCookies);
      console.log("☁️ Cookies cargadas desde Firestore");
    } else if (await fs.access(cookiesPath).then(() => true).catch(() => false)) {
      const diskCookies = JSON.parse(await fs.readFile(cookiesPath, 'utf8'));
      await page.setCookie(...diskCookies);
      console.log("💾 Cookies cargadas desde disco");
    }

    // Comprobar si sesión sigue activa
    const sessionValid = await verifySession(page);
    if (sessionValid) {
      console.log("✅ Sesión activa sin login");
      return true;
    }

    // 🔐 Login desde cero
    console.log("🔐 Iniciando login completo...");
    await page.goto('https://www.instagram.com/accounts/login/', {
      waitUntil: 'domcontentloaded',
      timeout: NAVIGATION_TIMEOUT
    });

    await page.waitForSelector('input[name="username"]', { visible: true, timeout: 20000 });

    const ua = new UserAgent({ deviceCategory: 'mobile' }).toString();
    await page.setUserAgent(ua);
    console.log(`📱 UA: ${ua}`);

    await humanBehavior.randomType(page, 'input[name="username"]', username);
    await humanBehavior.randomDelay(1500, 3000);
    await humanBehavior.randomType(page, 'input[name="password"]', password);
    await humanBehavior.randomDelay(1500, 3000);

    await page.click('button[type="submit"]');

    const loginSuccess = await Promise.race([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: LOGIN_TIMEOUT }),
      humanBehavior.randomDelay(10000, 15000)
    ]).then(() => true).catch(() => false);

    if (!loginSuccess) {
      console.error("❌ Timeout esperando navegación");
      return false;
    }

    const error = await page.$('#slfErrorAlert');
    if (error) {
      const msg = await page.$eval('#slfErrorAlert', el => el.textContent);
      console.error("❌ Error de login:", msg);
      return false;
    }

    // Guardar sesión
    const cookies = await page.cookies();
    await fs.writeFile(cookiesPath, JSON.stringify(cookies, null, 2));
    console.log("💾 Cookies guardadas en disco");

    if (db) {
      await db.collection('instagram_sessions').doc(username).set({
        cookies,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      console.log("☁️ Cookies guardadas en Firestore");
    }

    return true;
  } catch (err) {
    console.error("❌ Fallo durante login:", err.message);
    return false;
  }
}

// 🔍 Verificar si sesión está activa
async function verifySession(page) {
  try {
    await page.goto('https://www.instagram.com/', {
      waitUntil: 'networkidle0',
      timeout: NAVIGATION_TIMEOUT
    });

    const isLoggedIn = await page.evaluate(() => {
      return !!document.querySelector('svg[aria-label="Inicio"]');
    });

    return isLoggedIn;
  } catch {
    return false;
  }
}

// ☁️ Leer cookies de Firestore
async function loadFromFirestore(username) {
  if (!db) return [];

  try {
    const doc = await db.collection('instagram_sessions').doc(username).get();
    if (doc.exists && Array.isArray(doc.data().cookies)) {
      return doc.data().cookies;
    }
  } catch (err) {
    console.warn("⚠️ No se pudo cargar desde Firestore:", err.message);
  }

  return [];
}

module.exports = { instagramLogin };
