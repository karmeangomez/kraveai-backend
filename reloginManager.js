// reloginManager.js
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
const Logger = require('./logger');

puppeteer.use(StealthPlugin());

const logger = new Logger();

const COOKIES_DIR = path.join(__dirname, 'cookies');
const ACCOUNTS_FILE = path.join(__dirname, 'cuentas_creadas.json');

async function tryRelogin(account, cookiesPath) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: '/usr/bin/chromium-browser',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Cargar cookies si existen
    if (fs.existsSync(cookiesPath)) {
      const cookies = JSON.parse(fs.readFileSync(cookiesPath));
      await page.setCookie(...cookies);
    }

    // Ir al perfil para validar sesión
    await page.goto('https://www.instagram.com/accounts/edit/', { waitUntil: 'networkidle2', timeout: 30000 });

    const loggedIn = await page.$('input[name="biography"]');
    if (loggedIn) {
      logger.success(`✅ Cuenta @${account.usuario} revivida con cookies`);
      return true;
    }

    // Si no funcionaron las cookies, intentar login manual
    logger.warn(`🔁 Intentando login manual para @${account.usuario}`);
    await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle2' });
    await page.type('input[name="username"]', account.usuario, { delay: 60 });
    await page.type('input[name="password"]', account.password, { delay: 60 });
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 });

    const stillLoggedIn = await page.$('a[href="/accounts/edit/"]');
    if (stillLoggedIn) {
      logger.success(`✅ Cuenta @${account.usuario} revivida con login manual`);
      return true;
    } else {
      logger.error(`❌ Login fallido para @${account.usuario}`);
      return false;
    }

  } catch (e) {
    logger.error(`❌ Error al reintentar @${account.usuario}: ${e.message}`);
    return false;
  } finally {
    if (browser) await browser.close();
  }
}

function cargarCuentasFallidas() {
  if (!fs.existsSync(ACCOUNTS_FILE)) return [];

  const lines = fs.readFileSync(ACCOUNTS_FILE, 'utf8').split('\n').filter(Boolean);
  return lines.map(line => JSON.parse(line))
    .filter(acc => acc.status !== 'success' && !acc.recovered && acc.usuario && acc.password);
}

function actualizarEstado(usuario) {
  const lines = fs.readFileSync(ACCOUNTS_FILE, 'utf8').split('\n').filter(Boolean);
  const actualizadas = lines.map(line => {
    const acc = JSON.parse(line);
    if (acc.usuario === usuario) {
      acc.recovered = true;
      acc.status = 'success';
    }
    return JSON.stringify(acc);
  });

  fs.writeFileSync(ACCOUNTS_FILE, actualizadas.join('\n') + '\n');
}

async function reloginManager() {
  const fallidas = cargarCuentasFallidas();
  if (!fallidas.length) {
    logger.info('🎉 No hay cuentas fallidas para intentar revivir.');
    return;
  }

  for (const acc of fallidas) {
    const cookiesPath = path.join(COOKIES_DIR, `${acc.usuario}.json`);
    const revivida = await tryRelogin(acc, cookiesPath);
    if (revivida) {
      actualizarEstado(acc.usuario);
    } else {
      logger.warn(`💀 Cuenta @${acc.usuario} sigue muerta`);
    }
  }

  logger.info('🧠 Revivir de cuentas finalizado.');
}

reloginManager();
