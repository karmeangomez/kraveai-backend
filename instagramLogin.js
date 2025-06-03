const fs = require('fs').promises;
const path = require('path');
const UserAgent = require('user-agents');
const crypto = require('crypto');

const accountsDir = path.join(__dirname, 'accounts');
const sessionsDir = path.join(accountsDir, 'sessions');
const accountsFile = path.join(accountsDir, 'accounts.json');
const LOGIN_TIMEOUT = 60000;
const NAVIGATION_TIMEOUT = 30000;
const SESSION_CHECK_THRESHOLD = 43200000;
const INACTIVITY_THRESHOLD = 86400000;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');

const userAgentList = Array.from({ length: 50 }, () => new UserAgent({ deviceCategory: 'mobile' }).toString());
let userAgentIndex = 0;

function getNextUserAgent() {
  const ua = userAgentList[userAgentIndex];
  userAgentIndex = (userAgentIndex + 1) % userAgentList.length;
  return ua;
}

const humanBehavior = {
  randomDelay: (min = 500, max = 2000) => new Promise(resolve => setTimeout(resolve, min + Math.random() * (max - min))),
  randomType: async (page, selector, text) => {
    for (let char of text) {
      await page.type(selector, char, { delay: 50 + Math.random() * 50 });
      await humanBehavior.randomDelay(50, 150);
    }
  },
  randomScroll: async (page) => {
    const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
    for (let i = 0; i < 2; i++) {
      await page.evaluate(h => window.scrollBy(0, h * Math.random()), scrollHeight * 0.5);
      await humanBehavior.randomDelay(500, 1500);
    }
  }
};

async function logAction(message) {
  const logDir = path.join(__dirname, 'logs');
  await fs.mkdir(logDir, { recursive: true });
  const logFile = path.join(logDir, `activity_${new Date().toISOString().split('T')[0]}.log`);
  await fs.appendFile(logFile, `[${new Date().toISOString()}] ${message}\n`);
}

async function instagramLogin(page, username, password, cookiesFile = 'default') {
  const sessionKey = `${username}_${cookiesFile}`;
  const sessionPath = path.join(sessionsDir, `${sessionKey}.json`);
  const backupPrefix = path.join(sessionsDir, `${sessionKey}_backup_`);

  try {
    await logAction(`🔍 Revisando sesión para: ${username} (${sessionKey})`);
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
      await logAction("🟢 Usando sesión en caché (memoria)");
      await page.setCookie(...cachedSession.cookies);
      const sessionActive = await verifySession(page);
      if (sessionActive) {
        cachedSession.lastActivity = Date.now();
        cachedSessions.set(sessionKey, cachedSession);
        return true;
      }
    }

    let cookies = await loadValidCookies(sessionPath, backupPrefix);
    if (cookies.length > 0) {
      await logAction("📂 Usando sesión desde archivo local");
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

    await logAction(`⚠️ Sesión inválida para ${sessionKey}, intentando login`);

    for (let attempt = 1; attempt <= 3; attempt++) {
      await logAction(`🔐 Iniciando login completo (intento ${attempt}/3)`);
      await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT });

      const currentUrl = page.url();
      if (!currentUrl.includes('accounts/login')) {
        await logAction(`⚠️ Redirigido fuera de login: ${currentUrl}`);
        return false;
      }

      const isChallenge = await handleChallenge(page);
      if (isChallenge && attempt < 3) {
        continue;
      }

      const inputReady = await page.$('input[name="username"]', { timeout: 15000 });
      if (!inputReady) {
        await logAction("❌ El campo de usuario no apareció. La página no cargó bien.");
        return false;
      }

      const ua = getNextUserAgent();
      await page.setUserAgent(ua);
      await logAction(`📱 User-Agent: ${ua}`);

      await humanBehavior.randomType(page, 'input[name="username"]', username);
      await humanBehavior.randomDelay(500, 1000);
      const decryptedPassword = decrypt({ encryptedData: account.password, iv: account.iv });
      await humanBehavior.randomType(page, 'input[name="password"]', decryptedPassword);
      await humanBehavior.randomDelay(500, 1000);

      await page.click('button[type="submit"]').catch(() => logAction("⚠️ Botón de submit no encontrado"));

      const loginSuccess = await Promise.race([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: LOGIN_TIMEOUT }),
        humanBehavior.randomDelay(5000, 10000)
      ]).then(() => true).catch(() => false);

      if (loginSuccess) {
        const error = await page.$('#slfErrorAlert');
        if (error) {
          const msg = await page.$eval('#slfErrorAlert', el => el.textContent);
          await logAction(`❌ Error en login: ${msg}`);
          account.failCount++;
          if (attempt === 3) {
            account.status = 'inactive';
            await saveAccounts(accounts);
            return false;
          }
          await humanBehavior.randomDelay(15000, 30000);
          continue;
        }

        await handlePostLoginModals(page);
        const newCookies = await page.cookies();
        cachedSession = { username, cookies: newCookies, lastChecked: Date.now(), lastActivity: Date.now() };
        cachedSessions.set(sessionKey, cachedSession);
        await saveSession(sessionPath, newCookies);
        account.lastLogin = new Date().toISOString();
        account.failCount = 0;
        account.status = 'active';
        await saveAccounts(accounts);
        await logAction("🔁 Login completo y cookies guardadas");
        return true;
      }
    }

    account.status = 'inactive';
    await saveAccounts(accounts);
    return false;
  } catch (error) {
    await logAction(`❌ Fallo durante login para ${sessionKey}: ${error.message}`);
    return false;
  }
}

// Resto de las funciones (encrypt, decrypt, loadAccounts, saveAccounts, etc.) permanecen igual
