// crearCuentaInstagram.js
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const proxyChain = require('proxy-chain');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch');
const { generar_usuario, generar_nombre } = require('./nombre_utils');

puppeteer.use(StealthPlugin());

const TEMP_EMAIL_API = 'https://api.1secmail.com';
const MAX_ATTEMPTS = 7;
const INSTAGRAM_SIGNUP_URL = 'https://www.instagram.com/accounts/emailsignup/';
const COOKIES_DIR = path.join(__dirname, 'cookies');
const ACCOUNTS_FILE = path.join(__dirname, 'cuentas_creadas.json');
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Obtener el proxy desde los argumentos de línea de comandos
const proxy = process.argv[2];

async function humanType(page, selector, text) {
  await page.focus(selector);
  for (const char of text) {
    await page.type(selector, char, { delay: Math.random() * 40 + 20 });
    await delay(Math.random() * 100);
  }
}

async function moveMouseToElement(page, selector) {
  const rect = await page.evaluate(selector => {
    const el = document.querySelector(selector);
    if (!el) return null;
    const { x, y, width, height } = el.getBoundingClientRect();
    return { x: x + width / 2, y: y + height / 2 };
  }, selector);
  if (rect) await page.mouse.move(rect.x, rect.y, { steps: 10 });
}

async function detectInstagramErrors(page) {
  const selectors = ['#ssfErrorAlert', 'div[role="alert"]', 'p[id*="error"]', 'span[class*="error"]'];
  for (const sel of selectors) {
    const el = await page.$(sel);
    if (el) {
      const text = await page.evaluate(el => el.textContent, el);
      if (text) return text.trim();
    }
  }
  return null;
}

async function checkForCaptcha(page) {
  const captchaSelectors = ['iframe[src*="captcha"]', 'div[id*="recaptcha"]', 'form[action*="/challenge"]'];
  for (const sel of captchaSelectors) {
    if (await page.$(sel)) {
      return true;
    }
  }
  return false;
}

async function saveScreenshot(page, username) {
  if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR);
  const screenshotPath = path.join(SCREENSHOTS_DIR, `${username}_${Date.now()}.png`);
  await page.screenshot({ path: screenshotPath });
  return screenshotPath;
}

async function generateTempEmail() {
  try {
    const res = await fetch(`${TEMP_EMAIL_API}/v1/?action=genRandomMailbox&count=1`);
    const json = await res.json();
    return json[0];
  } catch {
    return `krave_${uuidv4().slice(0, 8)}@1secmail.com`;
  }
}

async function getVerificationCode(email) {
  const [login, domain] = email.split('@');
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    try {
      const res = await fetch(`${TEMP_EMAIL_API}/v1/?action=getMessages&login=${login}&domain=${domain}`);
      const messages = await res.json();
      for (const msg of messages) {
        if (msg.subject.toLowerCase().includes('instagram')) {
          const msgRes = await fetch(`${TEMP_EMAIL_API}/v1/?action=readMessage&login=${login}&domain=${domain}&id=${msg.id}`);
          const content = await msgRes.json();
          const match = /\b\d{6}\b/.exec(content.textBody || content.htmlBody);
          if (match) return match[0];
        }
      }
    } catch (e) {
      console.error(`Intento ${i + 1} fallido: ${e.message}`);
    }
    await delay(4000);
  }
  return await getCodeFallbackVisual(login, domain);
}

async function getCodeFallbackVisual(mailName, domain) {
  const fallbackURL = `https://email-fake.com/${domain}/${mailName}`;
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: '/usr/bin/chromium-browser',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.goto(fallbackURL, { waitUntil: 'domcontentloaded' });
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const title = await page.title();
      const match = title.match(/(\d{6})/);
      if (match) return match[1];
      await page.reload({ waitUntil: 'domcontentloaded' });
      await delay(3000);
    }
  } catch (e) {
    console.error('Error en fallback visual:', e.message);
  } finally {
    if (browser) await browser.close();
  }
  return null;
}

async function saveCookies(page, username) {
  const cookies = await page.cookies();
  if (!fs.existsSync(COOKIES_DIR)) fs.mkdirSync(COOKIES_DIR);
  const pathOut = path.join(COOKIES_DIR, `${username}.json`);
  fs.writeFileSync(pathOut, JSON.stringify(cookies, null, 2));
}

async function saveAccount(account) {
  const list = fs.existsSync(ACCOUNTS_FILE) ? JSON.parse(fs.readFileSync(ACCOUNTS_FILE)) : [];
  list.push({ ...account, creation_time: new Date().toISOString() });
  fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(list, null, 2));
}

async function createInstagramAccount() {
  const account = {
    usuario: '',
    email: '',
    password: '',
    proxy: proxy || 'none',
    status: 'error',
    error: '',
    timestamp: new Date().toISOString(),
    screenshots: []
  };
  let browser;
  let proxyAnon = null;

  try {
    if (!proxy) throw new Error('No se proporcionó un proxy válido');

    // Extraer hostname y puerto para Puppeteer, y credenciales si las hay
    const proxyRegex = /^(?:http:\/\/)?(?:(.+:.+?)@)?(.+:\d+)$/;
    const match = proxy.match(proxyRegex);
    if (!match) throw new Error(`Formato de proxy inválido: ${proxy}`);

    const [, credentials, hostPort] = match;
    proxyAnon = await proxyChain.anonymizeProxy(proxy);
    console.error(`🔍 Proxy anonimizado: ${proxyAnon}`);

    const args = ['--no-sandbox', '--disable-setuid-sandbox', `--proxy-server=${hostPort}`];

    browser = await puppeteer.launch({
      headless: true,
      args,
      executablePath: '/usr/bin/chromium-browser'
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/117.0.0.0 Safari/537.36');

    // Autenticar credenciales del proxy si existen
    if (credentials) {
      const [username, password] = credentials.split(':');
      await page.authenticate({ username, password });
    }

    await page.goto(INSTAGRAM_SIGNUP_URL, { waitUntil: 'networkidle2', timeout: 60000 });

    // Verificar si hay CAPTCHA o página de error
    if (await checkForCaptcha(page)) {
      account.screenshots.push(await saveScreenshot(page, 'captcha_detected'));
      throw new Error('CAPTCHA detectado en la página');
    }

    // Verificar si la página contiene el formulario esperado
    const emailInput = await page.$('input[name="emailOrPhone"]');
    if (!emailInput) {
      account.screenshots.push(await saveScreenshot(page, 'no_email_input'));
      throw new Error('No se encontró el campo emailOrPhone. Página no cargada correctamente.');
    }

    // Generar datos de la cuenta
    const username = generar_usuario();
    const fullName = generar_nombre();
    const password = uuidv4().slice(0, 12 pursuant: true);
    const email = await generateTempEmail();

    await moveMouseToElement(page, 'input[name="emailOrPhone"]');
    await humanType(page, 'input[name="emailOrPhone"]', email);
    await moveMouseToElement(page, 'input[name="fullName"]');
    await humanType(page, 'input[name="fullName"]', fullName);
    await moveMouseToElement(page, 'input[name="username"]');
    await humanType(page, 'input[name="username"]', username);
    await moveMouseToElement(page, 'input[name="password"]');
    await humanType(page, 'input[name="password"]', password);

    await page.click('button[type="submit"]');
    await delay(5000);

    const error = await detectInstagramErrors(page);
    if (error) {
      account.screenshots.push(await saveScreenshot(page, 'form_error'));
      throw new Error(error);
    }

    if (await page.$('input[name="email_confirmation_code"]')) {
      const code = await getVerificationCode(email);
      if (!code) {
        account.screenshots.push(await saveScreenshot(page, 'no_code'));
        throw new Error('No se recibió el código');
      }
      await humanType(page, 'input[name="email_confirmation_code"]', code);
      await page.click('button[type="button"]');
      await delay(3000);
    }

    account.status = 'success';
    account.usuario = username;
    account.email = email;
    account.password = password;
    await saveCookies(page, username);
  } catch (e) {
    account.error = e.message;
    console.error(`❌ Falló: ${e.message}`);
  } finally {
    if (browser) await browser.close();
    if (proxyAnon) await proxyChain.closeAnonymizedProxy(proxyAnon, true);
    await saveAccount(account);
    console.log(JSON.stringify(account));
  }
}

createInstagramAccount();
