// ✅ instagramLogin.js - Módulo optimizado para login y scraping de Instagram con Puppeteer
const fs = require('fs').promises;
const path = require('path');
const UserAgent = require('user-agents');
const crypto = require('crypto');

const accountsDir = path.join(__dirname, 'accounts');
const sessionsDir = path.join(accountsDir, 'sessions');
const accountsFile = path.join(accountsDir, 'accounts.json');
const LOGIN_TIMEOUT = 120000;
const NAVIGATION_TIMEOUT = 90000; // Aumentado a 90 segundos
const SESSION_CHECK_THRESHOLD = 86400000; // 24 horas
const INACTIVITY_THRESHOLD = 172800000; // 48 horas
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'mi-clave-secreta-32-bytes-aqui1234';

const humanBehavior = {
  randomDelay: (min = 1000, max = 5000) => new Promise(resolve => setTimeout(resolve, min + Math.random() * (max - min))),
  randomType: async (page, selector, text) => {
    for (let char of text) {
      await page.type(selector, char, { delay: 70 + Math.random() * 100 });
      await humanBehavior.randomDelay(150, 400);
    }
  },
  randomScroll: async (page) => {
    const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
    for (let i = 0; i < 3; i++) {
      await page.evaluate(h => window.scrollBy(0, h * Math.random()), scrollHeight);
      await humanBehavior.randomDelay(1000, 3000);
    }
  }
};

let cachedSessions = new Map();

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

async function loadAccounts() {
  try {
    await fs.mkdir(accountsDir, { recursive: true });
    await fs.mkdir(sessionsDir, { recursive: true });
    if (await fs.access(accountsFile).then(() => true).catch(() => false)) {
      return JSON.parse(await fs.readFile(accountsFile, 'utf8'));
    }
    return { accounts: [] };
  } catch (error) {
    console.error('❌ Error loading accounts:', error.message);
    return { accounts: [] };
  }
}

async function saveAccounts(accounts) {
  try {
    await fs.writeFile(accountsFile, JSON.stringify(accounts, null, 2));
    console.log('✅ Accounts saved successfully');
  } catch (error) {
    console.error('❌ Error saving accounts:', error.message);
  }
}

function getNextUserAgent() {
  const deviceCategories = ['desktop', 'mobile', 'tablet'];
  const category = deviceCategories[Math.floor(Math.random() * deviceCategories.length)];

  try {
    const userAgent = new UserAgent({ deviceCategory: category });
    return userAgent.toString();
  } catch (error) {
    console.warn(`⚠️ Error generando User-Agent con categoría ${category}: ${error.message}, intentando con configuración genérica`);
    try {
      const userAgent = new UserAgent();
      return userAgent.toString();
    } catch (error) {
      console.error(`❌ Fallo al generar User-Agent genérico: ${error.message}`);
      return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
    }
  }
}

async function instagramLogin(page, username, password, cookiesFile = 'default') {
  const sessionKey = `${username}_${cookiesFile}`;
  const sessionPath = path.join(sessionsDir, `${sessionKey}.json`);
  const backupPrefix = path.join(sessionsDir, `${sessionKey}_backup_`);

  try {
    console.log(`🔍 Revisando sesión para: ${username} (${sessionKey}) [${new Date().toISOString()}]`);
    const accounts = await loadAccounts();
    let account = accounts.accounts.find(a => a.username === username);

    if (!account) {
      const encrypted = encrypt(password);
      account = {
        username,
        password: encrypted.encryptedData,
        iv: encrypted.iv,
        sessionFile: sessionPath,
        lastLogin: new Date().toISOString(),
        status: 'active',
        failCount: 0
      };
      accounts.accounts.push(account);
      await saveAccounts(accounts);
    }

    let cachedSession = cachedSessions.get(sessionKey);
    if (cachedSession && Date.now() - cachedSession.lastChecked < SESSION_CHECK_THRESHOLD) {
      console.log("🟢 Usando sesión en caché (memoria)");
      await page.setCookie(...cachedSession.cookies);
      const sessionActive = await verifySession(page);
      if (sessionActive) {
        cachedSession.lastActivity = Date.now();
        cachedSessions.set(sessionKey, cachedSession);
        await saveSession(sessionPath, cachedSession.cookies);
        return true;
      }
    }

    let cookies = await loadValidCookies(sessionPath, backupPrefix);
    if (cookies.length > 0) {
      console.log("📂 Usando sesión desde archivo local");
      await page.setCookie(...cookies);
    }

    const sessionActive = await verifySession(page);
    if (sessionActive) {
      cachedSession = { username, cookies, lastChecked: Date.now(), lastActivity: Date.now() };
      cachedSessions.set(sessionKey, cachedSession);
      await saveSession(sessionPath, cookies);
      account.lastLogin = new Date().toISOString();
      await saveAccounts(accounts);
      return true;
    }

    console.warn(`⚠️ Sesión inválida para ${sessionKey}, intentando login`);

    let delay = 2000; // Retraso inicial
    for (let attempt = 1; attempt <= 5; attempt++) {
      console.log(`🔐 Iniciando login completo (intento ${attempt}/5)`);

      // Generar y aplicar un nuevo User-Agent para cada intento
      const ua = getNextUserAgent();
      await page.setUserAgent(ua);
      console.log(`📱 User-Agent: ${ua}`);

      await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT });

      // Verificar si la página de login se cargó esperando el selector
      const loginFormLoaded = await page.waitForSelector('input[name="username"]', { visible: true, timeout: 30000 })
        .then(() => true)
        .catch(() => false);
      if (!loginFormLoaded) {
        console.error('❌ La página de login no se cargó correctamente (selector no encontrado)');
        delay *= 2; // Backoff exponencial
        await humanBehavior.randomDelay(delay, delay + 3000);
        continue;
      }

      const isChallenge = await handleChallenge(page);
      if (isChallenge && attempt < 5) {
        console.warn("🚧 Desafío detectado, reintentando...");
        delay *= 2;
        await humanBehavior.randomDelay(delay, delay + 3000);
        continue;
      }

      await humanBehavior.randomDelay(1500, 3000);
      await humanBehavior.randomType(page, 'input[name="username"]', username);
      await humanBehavior.randomDelay(1500, 3000);
      const decryptedPassword = decrypt({ encryptedData: account.password, iv: account.iv });
      await humanBehavior.randomType(page, 'input[name="password"]', decryptedPassword);
      await humanBehavior.randomDelay(1500, 3000);

      await page.click('button[type="submit"]').catch(() => console.warn("⚠️ Botón de submit no encontrado"));

      const loginSuccess = await Promise.race([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: LOGIN_TIMEOUT }),
        humanBehavior.randomDelay(10000, 15000)
      ]).then(() => true).catch(() => false);

      if (loginSuccess) {
        const error = await page.$('#slfErrorAlert');
        if (error) {
          const msg = await page.$eval('#slfErrorAlert', el => el.textContent);
          console.error("❌ Error en login:", msg);
          account.failCount++;
          if (attempt === 5) {
            account.status = 'inactive';
            await saveAccounts(accounts);
            return false;
          }
          delay *= 2;
          await humanBehavior.randomDelay(delay, delay + 3000);
          continue;
        }

        await handlePostLoginModals(page);
        const newCookies = await page.cookies();
        cachedSession = { username, cookies: newCookies, lastChecked: Date.now(), lastActivity: Date.now() };
        cachedSessions.set(sessionKey, cachedSession);
        await saveSession(sessionPath, newCookies);
        account.lastLogin = new Date().toISOString();
        account.failCount =
