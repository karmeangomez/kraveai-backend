import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { generarNombreCompleto, generarNombreUsuario } from '../utils/nombre_utils.js';
import { generateAdaptiveFingerprint } from '../fingerprints/generator.js';
import { notifyTelegram } from '../utils/telegram_utils.js';
import fs from 'fs';

puppeteer.use(StealthPlugin());

async function crearCuentaInstagram(proxy, usarTor = false) {
  const fingerprint = generateAdaptiveFingerprint() || {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    screen: { width: 390, height: 844 }
  };

  const nombre = generarNombreCompleto();
  const username = generarNombreUsuario();
  const email = `${username.replace(/[^a-zA-Z0-9]/g, '')}@kraveapi.xyz`;
  const password = `Pass${Math.random().toString(36).slice(2, 10)}!`;

  const usandoTor = usarTor || !proxy || proxy.fallbackTor;
  const proxyUrl = usandoTor ? 'socks5://127.0.0.1:9050' : `${proxy.ip}:${proxy.port}`;

  try {
    if (usandoTor) {
      console.log('🧅 Usando Tor como fallback automático');
      await notifyTelegram('🧅 Sin proxies válidos, usando Tor para continuar');
    }

    const args = [
      `--proxy-server=${proxyUrl}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--enable-features=NetworkService',
      '--ignore-certificate-errors',
      '--disable-web-security',
      '--disable-blink-features=AutomationControlled',
      '--lang=en-US,en'
    ];

    const browser = await puppeteer.launch({
      headless: process.env.HEADLESS === 'true',
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args,
      ignoreHTTPSErrors: true
    });

    const page = await browser.newPage();

    if (!usandoTor && proxy.auth) {
      await page.authenticate({
        username: proxy.auth.username,
        password: proxy.auth.password
      });
    }

    await page.setUserAgent(fingerprint.userAgent);
    await page.setViewport({
      width: fingerprint.screen?.width || 390,
      height: fingerprint.screen?.height || 844,
      deviceScaleFactor: 2
    });

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'X-Forwarded-For': proxy?.ip || '127.0.0.1',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Upgrade-Insecure-Requests': '1'
    });

    await page.evaluateOnNewDocument(() => {
      delete navigator.__proto__.webdriver;
      delete navigator.__proto__.chrome;
      Object.defineProperty(navigator, 'plugins', {
        get: () => [{ name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' }]
      });
      Object.defineProperty(navigator, 'connection', {
        get: () => ({ downlink: 10, effectiveType: '4g', rtt: 50 })
      });
    });

    await page.goto('https://www.instagram.com', { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForTimeout(3000 + Math.random() * 4000);
    await page.goto('https://www.instagram.com/accounts/emailsignup/', { waitUntil: 'networkidle2', timeout: 60000 });

    const humanType = async (selector, text) => {
      for (let char of text) {
        await page.type(selector, char, { delay: Math.random() * 80 + 20 });
        await page.waitForTimeout(Math.random() * 200);
      }
    };

    await humanType('input[name="emailOrPhone"]', email);
    await page.waitForTimeout(1000 + Math.random() * 1500);
    await humanType('input[name="fullName"]', nombre);
    await page.waitForTimeout(800 + Math.random() * 1000);
    await humanType('input[name="username"]', username);
    await page.waitForTimeout(1200 + Math.random() * 1800);
    await humanType('input[name="password"]', password);
    await page.waitForTimeout(1500 + Math.random() * 2000);
    await page.click('button[type="submit"]', { delay: Math.random() * 100 + 50 });

    await page.waitForTimeout(5000 + Math.random() * 5000);

    const currentUrl = page.url();
    if (currentUrl.includes('/onboarding')) {
      console.log(`🎉 Cuenta creada: @${username}`);
      await browser.close();
      return { usuario: username, email, password, proxy: proxyUrl, status: 'created' };
    }

    throw new Error('No se llegó a la página de onboarding después del registro');
  } catch (error) {
    console.error(`🔥 Error creando cuenta @${username}: ${error.message}`);

    if (error.message.includes('ERR_INVALID_ARGUMENT')) {
      console.error('❌ Error proxy: ERR_INVALID_ARGUMENT');
    }

    return {
      usuario: '',
      email: '',
      password: '',
      proxy: proxyUrl,
      status: 'failed',
      error: error.message
    };
  }
}

export default crearCuentaInstagram;
