const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { loadCookies, saveCookies } = require('./cookies');
require('dotenv').config();

puppeteer.use(StealthPlugin());

async function instagramLogin() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome',
    ignoreHTTPSErrors: true
  });

  const page = await browser.newPage();
  const cookiesValid = await loadCookies(page);

  if (!cookiesValid) {
    console.log('🔐 Iniciando login manual en Instagram...');
    await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle2' });
    await page.waitForSelector('input[name="username"]', { timeout: 10000 });
    await page.type('input[name="username"]', process.env.IG_USERNAME, { delay: 50 });
    await page.type('input[name="password"]', process.env.INSTAGRAM_PASS, { delay: 50 });
    await page.click('button[type="submit"]');

    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
    await saveCookies(page);
    console.log('✅ Login exitoso y cookies guardadas');
  } else {
    console.log('✅ Sesión restaurada con cookies');
  }

  return { browser, page };
}

module.exports = { instagramLogin };
