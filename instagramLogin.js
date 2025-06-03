const fs = require('fs').promises;
const path = require('path');
const UserAgent = require('user-agents');
const db = require('./lib/firebase');
const crypto = require('crypto');

const cookiesDir = path.join(__dirname, 'cookies');
const LOGIN_TIMEOUT = 120000;
const NAVIGATION_TIMEOUT = 60000;
const SESSION_CHECK_THRESHOLD = 86400000;
const INACTIVITY_THRESHOLD = 172800000;
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

let cachedSession = null;

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

    if (cachedSession && cachedSession.username === username && Date.now() - cachedSession.lastChecked < SESSION_CHECK_THRESHOLD) {
      console.log("🟢 Usando sesión en caché (memoria)");
      await page.setCookie(...cachedSession.cookies);
      const sessionActive = await verifySession(page);
      if (sessionActive) {
        cachedSession.lastActivity = Date.now();
        console.log(`✅ Sesión activa desde caché para ${sessionKey}`);
        return true;
      }
    }

    let cookies = await loadValidCookies(cookiesPath, backupPath, username);
    if (cookies.length > 0) {
      console.log("📂 Usando sesión desde archivo local o Firestore");
      await page.setCookie(...cookies);
    }

    const sessionActive = await verifySession(page);
    if (sessionActive) {
      cachedSession = { username, cookies, lastChecked: Date.now(), lastActivity: Date.now() };
      console.log(`✅ Sesión activa detectada y/o restaurada para ${sessionKey}`);
      await saveSession(cookiesPath, cookies);
      return true;
    }

    console.warn(`⚠️ Sesión inválida para ${sessionKey}, intentando login`);

    for (let attempt = 1; attempt <= 3; attempt++) {
      console.log(`🔐 Iniciando login completo (intento ${attempt}/3)`);
      await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT });

      const isChallenge = await handleChallenge(page);
      if (isChallenge && attempt < 3) {
        console.warn("🚧 Desafío detectado, reintentando...");
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
        cachedSession = { username, cookies: newCookies, lastChecked: Date.now(), lastActivity: Date.now() };
        await saveSession(cookiesPath, newCookies);
        await saveToFirestore(username, newCookies);
        console.log("🔁 Login completo y cookies guardadas");
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error(`❌ Fallo durante login para ${sessionKey}:`, error.message);
    return false;
  }
}

module.exports = { instagramLogin };
