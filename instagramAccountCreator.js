// ✅ instagramAccountCreator.js - Creación masiva de cuentas con proxies y protección
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { Telegraf } = require('telegraf');
const { humanBehavior } = require('./instagramLogin');
const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteerExtra.use(StealthPlugin());

// Config
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'tu_token_aqui';
const FAKE_MAIL_BOT = '@fakemailbot';
const bot = new Telegraf(TELEGRAM_BOT_TOKEN);

const accountsDir = path.join(__dirname, 'accounts');
const createdAccountsFile = path.join(accountsDir, 'createdAccounts.json');

const firstNames = ['Juan', 'María', 'Carlos', 'Sofía', 'Luis', 'Ana', 'José', 'Lucía', 'Pedro', 'Isabel'];
const lastNames = ['García', 'Rodríguez', 'López', 'Martínez', 'Pérez', 'González', 'Hernández', 'Sánchez', 'Ramírez', 'Torres'];

async function fetchPublicProxies() {
  try {
    console.log('🌐 Obteniendo proxies públicas...');
    const response = await axios.get('https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all');
    const proxies = response.data.split('\r\n').filter(p => p.trim() !== '');
    return proxies.map(p => {
      const [host, port] = p.split(':');
      return { host, port };
    });
  } catch (error) {
    console.error('❌ Error obteniendo proxies:', error.message);
    return [];
  }
}

function generateRandomUsername() {
  const randomNum = Math.floor(Math.random() * 1000);
  const first = firstNames[Math.floor(Math.random() * firstNames.length)].toLowerCase();
  const last = lastNames[Math.floor(Math.random() * lastNames.length)].toLowerCase();
  return `${first}${last}${randomNum}`;
}

function generateRandomPassword() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.random() * chars.length);
  }
  return password;
}

function generateRandomFullName() {
  const first = firstNames[Math.floor(Math.random() * firstNames.length)];
  const last = lastNames[Math.floor(Math.random() * lastNames.length)];
  return `${first} ${last}`;
}

async function getFakeEmail() {
  try {
    await bot.telegram.sendMessage(FAKE_MAIL_BOT, '/start');
    await new Promise(r => setTimeout(r, 2000));
    await bot.telegram.sendMessage(FAKE_MAIL_BOT, 'Get a new fake mail id');
    await new Promise(r => setTimeout(r, 2000));
    const updates = await bot.telegram.getUpdates({ limit: 1, timeout: 10 });
    const email = updates[0]?.message?.text || 'default@example.com';
    console.log(`📧 Correo temporal obtenido: ${email}`);
    return email;
  } catch (error) {
    console.error('❌ Error obteniendo correo temporal:', error.message);
    return 'default@example.com';
  }
}

async function createInstagramAccountWithProxy(proxy) {
  const proxyArg = `--proxy-server=http://${proxy.host}:${proxy.port}`;
  const browser = await puppeteerExtra.launch({
    headless: true,
    args: [
      proxyArg,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled'
    ]
  });

  const page = await browser.newPage();
  try {
    console.log(`🌐 Usando proxy: ${proxy.host}:${proxy.port}`);
    await page.goto('https://www.instagram.com/accounts/emailsignup/', { waitUntil: 'networkidle2' });
    await humanBehavior.randomDelay(2000, 4000);

    const content = await page.content();
    if (content.includes('checkpoint') || content.includes('captcha')) {
      throw new Error('🚫 Instagram ha detectado actividad sospechosa');
    }

    const username = generateRandomUsername();
    const password = generateRandomPassword();
    const fullName = generateRandomFullName();
    const email = await getFakeEmail();

    await humanBehavior.randomType(page, 'input[name="emailOrPhone"]', email);
    await humanBehavior.randomDelay(1000, 2000);
    await humanBehavior.randomType(page, 'input[name="fullName"]', fullName);
    await humanBehavior.randomDelay(1000, 2000);
    await humanBehavior.randomType(page, 'input[name="username"]', username);
    await humanBehavior.randomDelay(1000, 2000);
    await humanBehavior.randomType(page, 'input[name="password"]', password);
    await humanBehavior.randomDelay(1000, 2000);
    await page.click('button[type="submit"]');

    console.log('✅ Formulario enviado, esperando respuesta...');
    await humanBehavior.randomDelay(3000, 5000);

    const accountData = { username, password, email, fullName, createdAt: new Date().toISOString() };
    await fs.mkdir(accountsDir, { recursive: true });
    const existing = JSON.parse(await fs.readFile(createdAccountsFile, 'utf8').catch(() => '[]'));
    existing.push(accountData);
    await fs.writeFile(createdAccountsFile, JSON.stringify(existing, null, 2));

    console.log(`✅ Cuenta creada: ${username}`);
    return accountData;
  } catch (error) {
    console.error('❌ Error al crear cuenta:', error.message);
    return null;
  } finally {
    await browser.close();
  }
}

async function createInstagramAccount() {
  const proxies = await fetchPublicProxies();
  for (let i = 0; i < 3; i++) {
    const proxy = proxies[i];
    const result = await createInstagramAccountWithProxy(proxy);
    if (result) return result;
  }
  console.warn('⚠️ Ninguna cuenta pudo ser creada tras varios intentos.');
  return null;
}

async function createMultipleAccounts(count) {
  const accounts = [];
  for (let i = 0; i < count; i++) {
    console.log(`🔄 Creando cuenta #${i + 1} de ${count}...`);
    const result = await createInstagramAccount();
    if (result) accounts.push(result);
    await humanBehavior.randomDelay(5000, 10000);
  }
  return accounts;
}

module.exports = { createMultipleAccounts };
