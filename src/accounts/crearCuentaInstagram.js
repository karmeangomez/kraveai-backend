// src/accounts/crearCuentaInstagram.js
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateRussianName, generateUsername } from '../utils/nombre_utils.js';
import emailManager from '../email/emailManager.js';
import proxyRotationSystem from '../proxies/proxyRotationSystem.js';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
puppeteer.use(StealthPlugin());

export default async function crearCuentaInstagram() {
  const username = generateUsername();
  const password = uuidv4().slice(0, 12);
  const fullName = generateRussianName();
  let email = '';

  const proxy = proxyRotationSystem.getBestProxy();
  console.log(`🛡️ Usando proxy: ${proxy.string}`);

  try {
    email = await emailManager.getRandomEmail();
    console.log(`📨 Email generado: ${email}`);
  } catch (err) {
    console.error('❌ Error generando email:', err.message);
    return;
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      `--proxy-server=${proxy.ip}:${proxy.port}`,
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  });

  const page = await browser.newPage();

  if (proxy.auth) {
    await page.authenticate({
      username: proxy.auth.username,
      password: proxy.auth.password
    });
  }

  try {
    await page.goto('https://www.instagram.com/accounts/emailsignup/', { timeout: 60000 });
    await page.waitForSelector('input[name=emailOrPhone]');

    await page.type('input[name=emailOrPhone]', email, { delay: 50 });
    await page.type('input[name=fullName]', fullName, { delay: 50 });
    await page.type('input[name=username]', username, { delay: 50 });
    await page.type('input[name=password]', password, { delay: 50 });
    await page.waitForTimeout(1500);
    await page.click('button[type=submit]');
    await page.waitForTimeout(4000);

    // Verificar que el perfil existe realmente
    const profileUrl = `https://www.instagram.com/${username}/`;
    const check = await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => null);
    if (!check || check.status() === 404) {
      throw new Error(`❌ La cuenta ${username} no fue creada realmente.`);
    }

    // Guardar cookies
    const cookies = await page.cookies();
    const cookiesPath = path.join(__dirname, `../cookies/${username}.json`);
    fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));

    // Guardar cuenta
    const cuenta = {
      username,
      password,
      email,
      cookiesPath,
      proxy: proxy.string,
      createdAt: new Date().toISOString()
    };

    const filePath = path.join(__dirname, '../cuentas_creadas.json');
    const existentes = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath)) : [];
    existentes.push(cuenta);
    fs.writeFileSync(filePath, JSON.stringify(existentes, null, 2));

    proxyRotationSystem.recordSuccess(proxy.string);
    console.log(`✅ Cuenta creada: @${username}`);
  } catch (error) {
    console.error('❌ Error creando cuenta:', error.message);
    proxyRotationSystem.recordFailure(proxy.string);
  } finally {
    await browser.close();
  }
}
