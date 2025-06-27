// src/accounts/sessionManager.js
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

puppeteer.use(StealthPlugin());
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function restoreInstagramSession(username) {
  const accountsData = JSON.parse(fs.readFileSync(path.join(__dirname, '../cuentas_creadas.json'), 'utf8'));
  const account = accountsData.find(acc => acc.username === username);
  if (!account) throw new Error(`Cuenta ${username} no encontrada`);

  const cookiesPath = path.join(__dirname, `../${account.cookiesPath}`);
  if (!fs.existsSync(cookiesPath)) throw new Error(`Cookies no encontradas para ${username}`);

  const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));

  const proxyArgs = account.proxy ? [`--proxy-server=${account.proxy}`] : [];

  const browser = await puppeteer.launch({
    headless: false,
    args: [
      ...proxyArgs,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--lang=es-ES',
      '--window-size=1200,800'
    ]
  });

  const page = await browser.newPage();
  try {
    await page.setCookie(...cookies);
  } catch (err) {
    console.error(`❌ Error cargando cookies: ${err.message}`);
  }

  await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle2' });

  const isLoggedIn = await page.evaluate(() => {
    return !!document.querySelector('a[href*="/accounts/logout/"]');
  });

  if (!isLoggedIn) {
    await browser.close();
    throw new Error(`❌ La sesión de ${username} no está activa`);
  }

  console.log(`✅ Sesión restaurada para @${username}`);
  return { browser, page, account };
}

export async function performAccountAction(username, actionCallback) {
  const { browser, page, account } = await restoreInstagramSession(username);

  try {
    await actionCallback(page, account);

    const updatedCookies = await page.cookies();
    fs.writeFileSync(
      path.join(__dirname, `../${account.cookiesPath}`),
      JSON.stringify(updatedCookies, null, 2)
    );
  } finally {
    await browser.close();
  }
}
