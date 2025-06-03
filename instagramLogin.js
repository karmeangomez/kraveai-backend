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

let cachedSessions = new Map();

async function loadAccounts() {
  try {
    await fs.mkdir(accountsDir, { recursive: true });
    await fs.mkdir(sessionsDir, { recursive: true });
    if (await fs.access(accountsFile).then(() => true).catch(() => false)) {
      return JSON.parse(await fs.readFile(accountsFile, 'utf8'));
    }
    return { accounts: [] };
  } catch (error) {
    console.error('Error loading accounts:', error);
    return { accounts: [] };
  }
}

async function saveAccounts(accounts) {
  await fs.writeFile(accountsFile, JSON.stringify(accounts, null, 2));
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

    for (let attempt = 1; attempt <= 3; attempt++) {
      console.log(`🔐 Iniciando login completo (intento ${attempt}/3)`);
      await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT });

      const currentUrl = page.url();
      if (!currentUrl.includes('accounts/login')) {
        console.warn(`⚠️ Redirigido fuera de login: ${currentUrl}`);
        return false;
      }

      const isChallenge = await handleChallenge(page);
      if (isChallenge && attempt < 3) {
        continue;
      }

      const inputReady = await page.$('input[name="username"]', { timeout: 15000 });
      if (!inputReady) {
        console.error("❌ El campo de usuario no apareció. La página no cargó bien.");
        return false;
      }

      const ua = getNextUserAgent();
      await page.setUserAgent(ua);
      console.log(`📱 User-Agent: ${ua}`);

      await humanBehavior.randomType(page, 'input[name="username"]', username);
      await humanBehavior.randomDelay(500, 1000);
      const decryptedPassword = decrypt({ encryptedData: account.password, iv: account.iv });
      await humanBehavior.randomType(page, 'input[name="password"]', decryptedPassword);
      await humanBehavior.randomDelay(500, 1000);

      await page.click('button[type="submit"]').catch(() => console.warn("⚠️ Botón de submit no encontrado"));

      const loginSuccess = await Promise.race([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: LOGIN_TIMEOUT }),
        humanBehavior.randomDelay(5000, 10000)
      ]).then(() => true).catch(() => false);

      if (loginSuccess) {
        const error = await page.$('#slfErrorAlert');
        if (error) {
          const msg = await page.$eval('#slfErrorAlert', el => el.textContent);
          console.error("❌ Error en login:", msg);
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
        console.log("🔁 Login completo y cookies guardadas");
        return true;
      }
    }

    account.status = 'inactive';
    await saveAccounts(accounts);
    return false;
  } catch (error) {
    console.error(`❌ Fallo durante login para ${sessionKey}:`, error.message);
    return false;
  }
}

async function verifySession(page) {
  try {
    const response = await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle0', timeout: NAVIGATION_TIMEOUT });
    if (response.status() >= 400) return false;
    const isActive = await page.evaluate(() => !!document.querySelector('svg[aria-label="Inicio"]'));
    if (isActive) {
      await humanBehavior.randomScroll(page);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function handleChallenge(page) {
  const isChallenge = await page.waitForFunction(() => window.location.href.includes('challenge'), { timeout: 15000 })
    .then(() => true).catch(() => false);
  if (isChallenge) {
    const challengeText = await page.evaluate(() => document.body.innerText.toLowerCase());
    if (challengeText.includes('verifica') || challengeText.includes('sospechosa') || challengeText.includes('captcha')) {
      console.log("🚧 Desafío detectado, pausa para intervención manual...");
      await new Promise(resolve => setTimeout(resolve, 300000));
      return true;
    }
  }
  return false;
}

async function handlePostLoginModals(page) {
  try {
    const modals = [
      '//button[contains(., "Ahora no") or contains(., "Not Now")]',
      '//button[contains(., "Denegar") or contains(., "Decline")]'
    ];
    for (const xpath of modals) {
      const elements = await page.$x(xpath, { timeout: 5000 });
      if (elements.length > 0) {
        await elements[0].click();
        await humanBehavior.randomDelay(500, 1000);
      }
    }
  } catch {}
}

async function saveSession(sessionPath, cookies) {
  const encrypted = encrypt(cookies);
  const backupPath = `${sessionPath}_backup_${Date.now()}.json`;
  await fs.writeFile(sessionPath, JSON.stringify(encrypted, null, 2));
  if (!(await fs.readdir(sessionsDir)).some(f => f.startsWith(path.basename(backupPath)) && Date.now() - parseInt(f.split('_backup_')[1].split('.')[0]) < 43200000)) {
    await fs.copyFile(sessionPath, backupPath).catch(() => {});
  }
}

async function loadValidCookies(sessionPath, backupPrefix) {
  const files = (await fs.readdir(sessionsDir)).filter(f => f.startsWith(path.basename(sessionPath)) || f.startsWith(path.basename(backupPrefix)));
  files.sort((a, b) => b.localeCompare(a));
  for (const file of files) {
    try {
      const filePath = path.join(sessionsDir, file);
      const encrypted = JSON.parse(await fs.readFile(filePath, 'utf8'));
      const cookies = decrypt(encrypted);
      if (await validateCookies(cookies)) return cookies;
    } catch {}
  }
  return [];
}

async function validateCookies(cookies) {
  if (!Array.isArray(cookies) || cookies.length === 0) return false;
  const sessionCookie = cookies.find(c => c.name === 'sessionid');
  if (!sessionCookie) return false;
  return !sessionCookie.expires || sessionCookie.expires * 1000 > Date.now() - SESSION_CHECK_THRESHOLD;
}

module.exports = { instagramLogin, getNextUserAgent };
