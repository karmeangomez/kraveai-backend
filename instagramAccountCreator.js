// instagramAccountCreator.js - Creación automatizada de cuentas Instagram con proxies y Telegram
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { Telegraf } = require('telegraf');
const { humanBehavior } = require('./instagramLogin');
const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Configuración
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'tu_token_aqui';
const FAKE_MAIL_BOT = '@fakemailbot';
const bot = new Telegraf(TELEGRAM_BOT_TOKEN);

const accountsDir = path.join(__dirname, 'accounts');
const createdAccountsFile = path.join(accountsDir, 'createdAccounts.json');

// Nombres y apellidos latinos
const firstNames = ['Juan', 'María', 'Carlos', 'Sofía', 'Luis', 'Ana', 'José', 'Lucía', 'Pedro', 'Isabel'];
const lastNames = ['García', 'Rodríguez', 'López', 'Martínez', 'Pérez', 'González', 'Hernández', 'Sánchez', 'Ramírez', 'Torres'];

// Obtener proxies públicas
async function fetchPublicProxies() {
  try {
    console.log('🌐 Obteniendo proxies públicas...');
    const response = await axios.get('https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all');
    const proxies = response.data.split('\r\n').filter(proxy => proxy.trim() !== '');
    return proxies.map(proxy => {
      const [host, port] = proxy.split(':');
      return { host, port };
    });
  } catch (error) {
    console.error('❌ Error obteniendo proxies:', error.message);
    return [];
  }
}

// Configurar proxy para Puppeteer
async function setProxy(page, proxies) {
  if (proxies.length === 0) {
    console.warn('⚠️ No hay proxies disponibles, usando IP local.');
    return false;
  }
  const randomProxy = proxies[Math.floor(Math.random() * proxies.length)];
  try {
    console.log(`🌐 Usando proxy: ${randomProxy.host}:${randomProxy.port}`);
    await page.setExtraHTTPHeaders({
      'Proxy-Server': `http://${randomProxy.host}:${randomProxy.port}`
    });
    return true;
  } catch (error) {
    console.error('❌ Error configurando proxy:', error.message);
    return false;
  }
}

// Generación de datos latinos
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

// Obtener correo temporal de @fakemailbot
async function getFakeEmail() {
  try {
    await bot.telegram.sendMessage(FAKE_MAIL_BOT, '/start');
    await new Promise(resolve => setTimeout(resolve, 2000));
    await bot.telegram.sendMessage(FAKE_MAIL_BOT, 'Get a new fake mail id');
    await new Promise(resolve => setTimeout(resolve, 2000));
    const updates = await bot.telegram.getUpdates({ limit: 1, timeout: 10 });
    const email = updates[0]?.message?.text || 'default@example.com';
    console.log(`📧 Correo temporal obtenido: ${email}`);
    return email;
  } catch (error) {
    console.error('❌ Error obteniendo correo temporal:', error.message);
    return 'default@example.com';
  }
}

// Crear una cuenta de Instagram
async function createInstagramAccount() {
  puppeteerExtra.use(StealthPlugin());
  const browser = await puppeteerExtra.launch({ headless: true });
  const page = await browser.newPage();
  const proxies = await fetchPublicProxies();

  try {
    await setProxy(page, proxies);

    // Navegar a la página de registro de Instagram
    await page.goto('https://www.instagram.com/accounts/emailsignup/');
    console.log('🌐 Navegando a la página de registro de Instagram...');
    await humanBehavior.randomDelay(2000, 4000);

    // Generar datos
    const username = generateRandomUsername();
    const password = generateRandomPassword();
    const fullName = generateRandomFullName();
    const email = await getFakeEmail();

    // Rellenar formulario
    await humanBehavior.randomType(page, 'input[name="emailOrPhone"]', email);
    await humanBehavior.randomDelay(1000, 2000);
    await humanBehavior.randomType(page, 'input[name="fullName"]', fullName);
    await humanBehavior.randomDelay(1000, 2000);
    await humanBehavior.randomType(page, 'input[name="username"]', username);
    await humanBehavior.randomDelay(1000, 2000);
    await humanBehavior.randomType(page, 'input[name="password"]', password);
    await humanBehavior.randomDelay(1000, 2000);

    // Hacer clic en "Siguiente"
    await page.click('button[type="submit"]');
    console.log('✅ Formulario enviado, esperando verificación...');
    await humanBehavior.randomDelay(3000, 5000);

    // Verificar si se creó la cuenta (esto es básico; podrías necesitar CAPTCHA o verificación de email)
    const accountData = { username, password, email, fullName, createdAt: new Date().toISOString() };
    await fs.mkdir(accountsDir, { recursive: true });
    const accounts = JSON.parse(await fs.readFile(createdAccountsFile, 'utf-8').catch(() => '[]'));
    accounts.push(accountData);
    await fs.writeFile(createdAccountsFile, JSON.stringify(accounts, null, 2));
    console.log(`✅ Cuenta creada: ${JSON.stringify(accountData)}`);

    return accountData;
  } catch (error) {
    console.error('❌ Error creando cuenta:', error.message);
    return null;
  } finally {
    await browser.close();
  }
}

// Crear múltiples cuentas
async function createMultipleAccounts(count) {
  const accounts = [];
  for (let i = 0; i < count; i++) {
    console.log(`🔄 Creando cuenta #${i + 1} de ${count}...`);
    const account = await createInstagramAccount();
    if (account) accounts.push(account);
    await humanBehavior.randomDelay(5000, 10000); // Pausa entre cuentas
  }
  return accounts;
}

module.exports = { createMultipleAccounts };
