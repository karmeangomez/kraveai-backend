// ✅ instagramLogin.js - Versión mejorada con detección adaptable
const fs = require('fs').promises;
const path = require('path');
const UserAgent = require('user-agents');
const crypto = require('crypto');

const accountsDir = path.join(__dirname, 'accounts');
const sessionsDir = path.join(accountsDir, 'sessions');
const accountsFile = path.join(accountsDir, 'accounts.json');
const LOGIN_TIMEOUT = 120000;
const NAVIGATION_TIMEOUT = 90000; // 90 segundos
const SESSION_CHECK_THRESHOLD = 86400000; // 24 horas
const INACTIVITY_THRESHOLD = 172800000; // 48 horas
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'mi-clave-secreta-32-bytes-aqui1234';
const DELAY_MULTIPLIER = parseFloat(process.env.INSTAGRAM_DELAY_MULTIPLIER) || 1.5;

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
    console.warn(`⚠️ Error generando User-Agent con categoría ${category}: ${error.message}`);
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

      // 1. Rotación inteligente de User-Agent
      const ua = getNextUserAgent();
      await page.setUserAgent(ua);
      console.log(`📱 User-Agent: ${ua}`);

      // 2. Navegación con detección de estado
      const navigationResult = await handleNavigation(page, attempt);
      if (navigationResult === 'HOME_PAGE') {
        console.log('✅ Redirección a página principal detectada');
        return handleSuccessfulLogin(page, account, sessionPath, sessionKey, cachedSessions);
      }
      if (navigationResult === 'CHALLENGE') continue;

      // 3. Detección adaptable del formulario de login
      const loginState = await detectLoginState(page);
      if (loginState === 'LOGGED_IN') {
        return handleSuccessfulLogin(page, account, sessionPath, sessionKey, cachedSessions);
      }
      if (loginState !== 'LOGIN_FORM') {
        await handleNavigationIssues(page, attempt);
        continue;
      }

      // 4. Ejecución del login con verificación en tiempo real
      await executeLoginForm(page, username, account);

      // 5. Validación post-login
      const loginResult = await verifyLoginResult(page);
      if (loginResult === 'SUCCESS') {
        return handleSuccessfulLogin(page, account, sessionPath, sessionKey, cachedSessions);
      }

      // 6. Manejo de errores específicos
      await handleLoginErrors(page, loginResult, attempt, account, accounts, sessionKey);
      delay = calculateBackoffDelay(attempt);
      await humanBehavior.randomDelay(delay, delay + 3000);
    }

    return handleFinalFailure(account, accounts);
  } catch (error) {
    console.error(`❌ Fallo durante login para ${sessionKey}:`, error.message);
    return false;
  }
}

// --- Funciones auxiliares mejoradas ---

async function handleNavigation(page, attempt) {
  try {
    await page.goto('https://www.instagram.com/accounts/login/', {
      waitUntil: 'networkidle0',
      timeout: NAVIGATION_TIMEOUT,
      referer: 'https://www.google.com/'
    });

    // Detección temprana de redirección a página principal
    const currentUrl = page.url();
    if (!currentUrl.includes('/accounts/login')) {
      return 'HOME_PAGE';
    }

    // Detección de desafíos de seguridad
    if (await detectSecurityChallenge(page)) {
      console.warn('🚧 Desafío de seguridad detectado');
      await handleSecurityChallenge(page);
      return 'CHALLENGE';
    }

    return 'LOGIN_PAGE';
  } catch (error) {
    console.error(`🚨 Error de navegación (intento ${attempt}):`, error.message);
    await page.reload();
    return 'ERROR';
  }
}

async function detectLoginState(page) {
  // Sistema de detección multi-capa
  const stateChecks = [
    { // 1. Verificación de sesión activa
      test: async () => await page.$('a[href="/accounts/activity/"]'),
      result: 'LOGGED_IN'
    },
    { // 2. Detección de formulario clásico
      test: async () => await page.waitForSelector('input[name="username"], input[aria-label*="username"], input[type="text"]', 
          { timeout: 15000, visible: true }),
      result: 'LOGIN_FORM'
    },
    { // 3. Detección de login con teléfono
      test: async () => await page.waitForSelector('input[type="tel"]', { timeout: 5000 }),
      result: 'PHONE_LOGIN'
    },
    { // 4. Detección de errores
      test: async () => await page.waitForSelector('#slfErrorAlert, .error-container', { timeout: 5000 }),
      result: 'ERROR_STATE'
    }
  ];

  for (const check of stateChecks) {
    try {
      await check.test();
      return check.result;
    } catch (error) {
      // Continuar con siguiente chequeo
    }
  }

  // 5. Fallback: Análisis de contenido de página
  const content = await page.content();
  if (content.includes('Forgot Password') || content.includes('Contraseña olvidada')) {
    return 'LOGIN_FORM';
  }

  return 'UNKNOWN_STATE';
}

async function executeLoginForm(page, username, account) {
  // 1. Identificación dinámica de campos
  const usernameField = await page.$('input[name="username"], input[aria-label*="username"], input[type="text"]');
  const passwordField = await page.$('input[name="password"], input[aria-label*="password"], input[type="password"]');

  // 2. Interacción humana mejorada
  await usernameField.click({ clickCount: 3 });
  await humanBehavior.randomType(page, '', username); // Selector vacío usa elemento enfocado

  await passwordField.click({ clickCount: 3 });
  const decryptedPassword = decrypt({ encryptedData: account.password, iv: account.iv });
  await humanBehavior.randomType(page, '', decryptedPassword);

  // 3. Envío inteligente
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0', timeout: LOGIN_TIMEOUT }),
    page.keyboard.press('Enter')
  ]);
}

async function verifyLoginResult(page) {
  // Sistema de verificación multicapa
  try {
    // 1. Detección de login exitoso
    await page.waitForSelector('svg[aria-label="Home"], div[role="main"]', { timeout: 20000 });
    return 'SUCCESS';
  } catch (error) {
    // 2. Detección de errores específicos
    if (await page.$('#slfErrorAlert')) {
      const errorText = await page.$eval('#slfErrorAlert', el => el.innerText);
      console.error(`❌ Error de credenciales: ${errorText}`);
      return 'CREDENTIAL_ERROR';
    }

    // 3. Detección de desafíos de seguridad
    if (await page.$('input[name="security_code"]')) {
      console.warn('⚠️ Verificación de seguridad requerida');
      return 'SECURITY_CHALLENGE';
    }

    // 4. Detección de restricciones
    if ((await page.content()).includes('suspended') || (await page.content()).includes('suspendida')) {
      console.error('⛔ Cuenta suspendida o restringida');
      return 'ACCOUNT_SUSPENDED';
    }
  }
  return 'UNKNOWN_ERROR';
}

async function handleNavigationIssues(page, attempt) {
  // Estrategias de recuperación
  const strategies = [
    async () => {
      console.log('🔄 Forzando recarga completa');
      await page.reload({ waitUntil: 'networkidle0', timeout: NAVIGATION_TIMEOUT });
    },
    async () => {
      console.log('🧹 Limpiando caché de página');
      await page.evaluate(() => location.reload(true));
    },
    async () => {
      console.log('🚫 Eliminando cookies de sesión');
      const cookies = await page.cookies();
      const instagramCookies = cookies.filter(c => c.domain.includes('instagram'));
      await page.deleteCookie(...instagramCookies);
    }
  ];

  // Aplicar estrategias secuencialmente
  for (const strategy of strategies.slice(0, attempt)) {
    await strategy();
    await humanBehavior.randomDelay(2000, 5000);
    if (await detectLoginState(page) === 'LOGIN_FORM') return true;
  }
  return false;
}

async function detectSecurityChallenge(page) {
  const isChallenge = await page.waitForFunction(() => window.location.href.includes('challenge'), { timeout: 20000 })
    .then(() => true).catch(() => false);
  if (isChallenge) {
    const challengeText = await page.evaluate(() => document.body.innerText.toLowerCase());
    return challengeText.includes('verifica') || challengeText.includes('sospechosa') || challengeText.includes('captcha');
  }
  return false;
}

async function handleSecurityChallenge(page) {
  console.log('⏳ Esperando resolución manual de desafío (2 minutos)');
  await humanBehavior.randomDelay(120000, 120000);
}

async function handleSuccessfulLogin(page, account, sessionPath, sessionKey, cachedSessions) {
  await handlePostLoginModals(page);
  const newCookies = await page.cookies();
  const cachedSession = { username: account.username, cookies: newCookies, lastChecked: Date.now(), lastActivity: Date.now() };
  cachedSessions.set(sessionKey, cachedSession);
  await saveSession(sessionPath, newCookies);
  account.lastLogin = new Date().toISOString();
  account.failCount = 0;
  account.status = 'active';
  await saveAccounts({ accounts: [account] }); // Actualiza solo la cuenta afectada
  console.log("🔁 Login completo y cookies guardadas");
  return true;
}

async function handleLoginErrors(page, loginResult, attempt, account, accounts, sessionKey) {
  account.failCount++;
  if (attempt === 5) {
    account.status = 'inactive';
    await saveAccounts(accounts);
  }
  if (loginResult === 'SECURITY_CHALLENGE') {
    console.warn('⚠️ Retraso adicional por desafío de seguridad');
    await humanBehavior.randomDelay(60000, 120000);
  }
}

function calculateBackoffDelay(attempt) {
  return Math.pow(2, attempt - 1) * 2000 * DELAY_MULTIPLIER;
}

async function handleFinalFailure(account, accounts) {
  account.status = 'inactive';
  await saveAccounts(accounts);
  return false;
}

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
        await humanBehavior.randomDelay(1000, 2000);
      }
    }
  } catch {}
}

async function saveSession(sessionPath, cookies) {
  const encrypted = encrypt(cookies);
  const backupPath = `${sessionPath}_backup_${Date.now()}.json`;
  await fs.writeFile(sessionPath, JSON.stringify(encrypted, null, 2));
  await fs.copyFile(sessionPath, backupPath).catch(() => {});
}

async function loadValidCookies(sessionPath, backupPrefix) {
  let cookies = [];
  const files = await fs.readdir(sessionsDir).catch(() => []);

  for (let file of files) {
    if (file.startsWith(path.basename(sessionPath)) || file.startsWith(path.basename(backupPrefix))) {
      try {
        const filePath = path.join(sessionsDir, file);
        const encrypted = JSON.parse(await fs.readFile(filePath, 'utf8'));
        cookies = decrypt(encrypted);
        if (await validateCookies(cookies)) return cookies;
      } catch {}
    }
  }
  return [];
}

async function validateCookies(cookies) {
  if (!Array.isArray(cookies) || cookies.length === 0) return false;
  const sessionCookie = cookies.find(c => c.name === 'sessionid');
  if (!sessionCookie) return false;
  if (sessionCookie.expires && sessionCookie.expires * 1000 < Date.now()) {
    console.log("⏰ Cookie sessionid expirada, rotando sesión...");
    return false;
  }
  return true;
}

async function verifySession(page) {
  try {
    const response = await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle0', timeout: NAVIGATION_TIMEOUT });
    if (response.status() >= 400) return false;
    const isActive = await page.evaluate(() => document.querySelector('svg[aria-label="Inicio"]') !== null);
    return isActive;
  } catch {
    return false;
  }
}

module.exports = { instagramLogin };
