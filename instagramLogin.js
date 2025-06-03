const fs = require('fs').promises;
const path = require('path');
const UserAgent = require('user-agents');
const crypto = require('crypto');

const cookiesDir = path.join(__dirname, 'cookies');
const LOGIN_TIMEOUT = 120000; // 2 minutos para login crítico
const NAVIGATION_TIMEOUT = 60000; // 1 minuto
const SESSION_CHECK_THRESHOLD = 86400000; // 24 horas antes de verificar
const BACKUP_INTERVAL = 7200000; // 2 horas para respaldos

const humanBehavior = {
  randomDelay: (min = 1000, max = 5000) => new Promise(resolve =>
    setTimeout(resolve, min + Math.random() * (max - min))),
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

// Almacenar sesiones en memoria y respaldos
let cachedSession = null;
let lastActivity = Date.now();
let backupInterval = null;

async function instagramLogin(page, username, password, cookiesFile = 'default') {
  const cookiesPath = path.join(cookiesDir, `${cookiesFile}.json`);
  const backupPath = path.join(cookiesDir, `${cookiesFile}_backup_${Date.now()}.json`);

  try {
    console.log(`🔍 Revisando sesión para: ${username}`);
    await fs.mkdir(cookiesDir, { recursive: true });

    // Iniciar respaldo automático si no está activo
    if (!backupInterval) {
      backupInterval = setInterval(() => backupCookies(cookiesPath, backupPath), BACKUP_INTERVAL);
    }

    // Usar sesión en caché si está reciente y válida
    if (cachedSession && Date.now() - cachedSession.lastChecked < SESSION_CHECK_THRESHOLD) {
      await page.setCookie(...cachedSession.cookies);
      console.log("🍪 Usando sesión en caché");
      const sessionActive = await verifyCriticalSession(page);
      if (sessionActive) {
        lastActivity = Date.now();
        console.log("✅ Sesión activa desde caché");
        return true;
      }
    }

    // Cargar cookies desde disco o respaldo
    let cookies = await loadValidCookies(cookiesPath, backupPath);
    if (cookies.length > 0) {
      await page.setCookie(...cookies);
      console.log("🍪 Cookies cargadas desde disco o respaldo");
    }

    // Verificar sesión crítica
    const sessionActive = await verifyCriticalSession(page);
    if (sessionActive) {
      cachedSession = { cookies, lastChecked: Date.now() };
      lastActivity = Date.now();
      console.log("✅ Sesión activa detectada y/o restaurada");
      return true;
    }

    console.warn("⚠️ Sesión crítica inválida, intentando restaurar o login");

    // Intentar restaurar desde respaldo si el refresco falla
    if (!sessionActive && await fs.access(backupPath).then(() => true).catch(() => false)) {
      cookies = JSON.parse(await fs.readFile(backupPath, 'utf8'));
      await page.setCookie(...cookies);
      console.log("🔄 Restaurando desde respaldo");
      const restoredSession = await verifyCriticalSession(page);
      if (restoredSession) {
        cachedSession = { cookies, lastChecked: Date.now() };
        lastActivity = Date.now();
        await fs.writeFile(cookiesPath, JSON.stringify(cookies, null, 2));
        console.log("✅ Sesión restaurada con éxito");
        return true;
      }
    }

    // Login completo como última medida (con reintentos y manejo de desafíos)
    for (let attempt = 1; attempt <= 3; attempt++) {
      console.log(`🔐 Iniciando login completo (intento ${attempt}/3)...`);
      await page.goto('https://www.instagram.com/accounts/login/', {
        waitUntil: 'domcontentloaded',
        timeout: NAVIGATION_TIMEOUT
      });

      const isChallenge = await page.waitForFunction(() => window.location.href.includes('challenge'), { timeout: 20000 })
        .then(() => true).catch(() => false);
      if (isChallenge) {
        console.warn("🚧 Detectado desafío, reintentando...");
        await humanBehavior.randomDelay(30000, 60000); // Esperar antes de reintentar
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
          await humanBehavior.randomDelay(30000, 60000); // Esperar más antes del próximo intento
          continue;
        }

        try {
          const dialogs = await page.$x('//button[contains(., "Ahora no") or contains(., "Not Now")]');
          if (dialogs.length > 0) {
            await dialogs[0].click();
            console.log("🧼 Cerrado modal de 'Ahora no'");
            await humanBehavior.randomDelay(1000, 2000);
          }
        } catch (e) {
          console.log("ℹ️ No se encontró modal de 'Ahora no'");
        }

        const newCookies = await page.cookies();
        await fs.writeFile(cookiesPath, JSON.stringify(newCookies, null, 2));
        cachedSession = { cookies: newCookies, lastChecked: Date.now() };
        lastActivity = Date.now();
        console.log("✅ Login exitoso y cookies guardadas");
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error("❌ Fallo durante login:", error.message);
    return false;
  }
}

// Función para verificar sesión crítica
async function verifyCriticalSession(page) {
  try {
    const response = await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle0', timeout: NAVIGATION_TIMEOUT });
    if (response.status() >= 400) {
      console.warn(`⚠️ Código de estado HTTP: ${response.status()}`);
      return false;
    }
    const isActive = await page.evaluate(() => {
      return document.querySelector('svg[aria-label="Inicio"]') !== null;
    });
    return isActive;
  } catch (e) {
    return false;
  }
}

// Función para cargar cookies válidas (disco o respaldo)
async function loadValidCookies(cookiesPath, backupPath) {
  let cookies = [];
  if (await fs.access(cookiesPath).then(() => true).catch(() => false)) {
    cookies = JSON.parse(await fs.readFile(cookiesPath, 'utf8'));
  } else if (await fs.access(backupPath).then(() => true).catch(() => false)) {
    cookies = JSON.parse(await fs.readFile(backupPath, 'utf8'));
    await fs.writeFile(cookiesPath, JSON.stringify(cookies, null, 2)); // Restaurar desde respaldo
  }
  return cookies;
}

// Función para respaldar cookies
async function backupCookies(cookiesPath, backupPath) {
  if (await fs.access(cookiesPath).then(() => true).catch(() => false)) {
    const cookies = JSON.parse(await fs.readFile(cookiesPath, 'utf8'));
    await fs.writeFile(backupPath, JSON.stringify(cookies, null, 2));
    console.log("💾 Cookies respaldadas");
  }
}

module.exports = { instagramLogin };
