const fs = require('fs').promises; // Usar fs.promises directamente
const path = require('path');
const proxyChain = require('proxy-chain');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { loadCookies, saveCookies } = require('./cookies');
const { getNextProxy } = require('./proxyBank');
const UserAgent = require('user-agents');

puppeteer.use(StealthPlugin());

const COOKIE_PATH = path.join(__dirname, 'sessions', 'kraveaibot.json');

async function smartLogin(username, password, sessionPath) {
  const proxyUrlRaw = getNextProxy();
  let proxyUrl = null;
  let browser, page;

  if (proxyUrlRaw) {
    try {
      proxyUrl = await proxyChain.anonymizeProxy(`http://${proxyUrlRaw}`);
      console.log('✅ Proxy válido:', proxyUrl);
    } catch (err) {
      console.warn('⚠️ Proxy inválido:', proxyUrlRaw);
    }
  }

  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-zygote',
        '--disable-extensions',
        '--window-size=1280,800',
        ...(proxyUrl ? [`--proxy-server=${proxyUrl}`] : [])
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome',
      ignoreHTTPSErrors: true
    });

    page = await browser.newPage();
    await page.setUserAgent(new UserAgent({ deviceCategory: 'desktop' }).toString());
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
    await page.setRequestInterception(true);
    page.on('request', req => {
      const type = req.resourceType();
      if (['image', 'media', 'font', 'stylesheet'].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.goto('https://www.instagram.com/accounts/login/', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await page.waitForSelector('input[name="username"]', { timeout: 15000 });
    await page.type('input[name="username"]', username, { delay: 50 });
    await page.type('input[name="password"]', password, { delay: 50 });

    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 90000 });

    const url = page.url();
    if (url.includes('/challenge') || url.includes('/error')) {
      throw new Error('Instagram rechazó el login (challenge o IP bloqueada)');
    }

    const cookies = await page.cookies();
    await saveCookies(cookies, sessionPath);
    console.log('🔐 Login exitoso y cookies guardadas');
    return { success: true, browser, page };
  } catch (err) {
    console.error('❌ Error en smartLogin:', err.message);
    if (page && !page.isClosed()) await page.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    if (proxyUrl) await
