const fs = require('fs').promises;
const path = require('path');
const UserAgent = require('user-agents');
const crypto = require('crypto');

const cookiesDir = path.join(__dirname, 'cookies');
const LOGIN_TIMEOUT = 120000; // 2 minutos para login crítico
const NAVIGATION_TIMEOUT = 60000; // 1 minuto
const SESSION_CHECK_THRESHOLD = 86400000; // 24 horas antes de verificar
const BACKUP_INTERVAL = 7200000; // 2 horas para respaldos

// Utilidades para simular comportamiento humano
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
  },
  clickIfExists: async (page, selector) => {
    const element = await page.$(selector);
    if (element) {
      await element.click();
      await humanBehavior.randomDelay(500, 1500);
      return true;
    }
    return false;
  }
};

// Almacenamiento de sesiones en memoria
const sessionsCache = new Map();
let backupInterval = null;

async function instagramLogin(page, username, password, cookiesFile = 'default') {
  const sessionKey = `${username}_${cookiesFile}`;
  const cookiesPath = path.join(cookiesDir, `${sessionKey}.json`);
  const backupPath = path.join(cookiesDir, `${sessionKey}_backup_${Date.now()}.json`);

  try {
    console.log(`🔍 Revisando sesión para: ${username} (${sessionKey})`);
    await fs.mkdir(cookiesDir, { recursive: true });

    // Iniciar respaldo automático si no está activo
    if (!backupInterval) {
      backupInterval = setInterval(() => backupCookies(cookiesPath, backupPath), BACKUP_INTERVAL);
    }

    // Usar sesión en caché si está reciente y válida
    if (sessionsCache.has(sessionKey) && Date.now() - sessionsCache.get(sessionKey).lastChecked < SESSION_CHECK_THRESHOLD) {
      const cachedSession = sessionsCache.get(sessionKey);
      await page.setCookie(...cachedSession.cookies);
      console.log(`🍪 Usando sesión en caché para ${sessionKey}`);
      const sessionActive = await verifyCriticalSession(page);
      if (sessionActive) {
        cachedSession.lastActivity = Date.now();
        console.log(`✅ Sesión activa desde caché para ${sessionKey}`);
        return true;
      }
    }

    // Cargar cookies desde disco o respaldo
    let cookies = await loadValidCookies(cookiesPath, backupPath);
    if (cookies.length > 0) {
      await page.setCookie(...cookies);
      console.log(`🍪 Cookies cargadas desde disco o respaldo para ${sessionKey}`);
    }

    // Verificar sesión crítica
    const sessionActive = await verifyCriticalSession(page);
    if (sessionActive) {
      sessionsCache.set(sessionKey, { cookies, lastChecked: Date.now(), lastActivity: Date.now() });
      console.log(`✅ Sesión activa detectada y/o restaurada para ${sessionKey}`);
      return true;
    }

    console.warn(`⚠️ Sesión crítica inválida para ${sessionKey}, intentando restaurar o login`);

    // Intentar restaurar desde respaldo
    if (!sessionActive && await fs.access(backupPath).then(() => true).catch(() => false)) {
      cookies = JSON.parse(await fs.readFile(backupPath, 'utf8'));
      await page.setCookie(...cookies);
      console.log(`🔄 Restaurando desde respaldo para ${sessionKey}`);
      const restoredSession = await verifyCriticalSession(page);
      if (restoredSession) {
        sessionsCache.set(sessionKey, { cookies, lastChecked: Date.now(), lastActivity: Date.now() });
        await fs.writeFile(cookiesPath, JSON.stringify(cookies, null, 2));
        console.log(`✅ Sesión restaurada con éxito para ${sessionKey}`);
        return true;
      }
    }

    // Login completo como última medida (con manejo de desafíos)
    for (let attempt = 1; attempt <= 3; attempt++) {
      console.log(`🔐 Iniciando login completo (intento ${attempt}/3) para ${sessionKey}...`);
      await page.goto('https://www.instagram.com/accounts/login/', {
        waitUntil: 'domcontentloaded',
        timeout: NAVIGATION_TIMEOUT
      });

      // Manejar desafíos
      const isChallenge = await handleChallenge(page);
      if (isChallenge && attempt < 3) {
        console.warn("🚧 Detectado desafío, reintentando...");
        await humanBehavior.randomDelay(30000, 60000);
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
        await fs.writeFile(cookiesPath, JSON.stringify(newCookies, null, 2));
        sessionsCache.set(sessionKey, { cookies: newCookies, lastChecked: Date.now(), lastActivity: Date.now() });
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

// Verificar sesión crítica
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
    if (isActive) await humanBehavior.randomScroll(page); // Simular actividad mínima
    return isActive;
  } catch (e) {
    return false;
  }
}

// Manejar desafíos de Instagram
async function handleChallenge(page) {
  const isChallenge = await page.waitForFunction(() => window.location.href.includes('challenge'), { timeout: 20000 })
    .then(() => true).catch(() => false);
  if (isChallenge) {
    const challengeType = await page.evaluate(() => document.body.innerText.toLowerCase());
    if (challengeType.includes('verifica') || challengeType.includes('sospechosa')) {
      console.log("🚧 Desafío detectado: actividad sospechosa o verificación requerida");
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

// Cargar cookies válidas
async function loadValidCookies(cookiesPath, backupPath) {
  let cookies = [];
  if (await fs.access(cookiesPath).then(() => true).catch(() => false)) {
    cookies = JSON.parse(await fs.readFile(cookiesPath, 'utf8'));
  } else
