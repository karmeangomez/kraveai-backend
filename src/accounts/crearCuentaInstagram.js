import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { generarNombreCompleto, generarNombreUsuario } from '../utils/nombre_utils.js';
import { generateAdaptiveFingerprint } from '../fingerprints/generator.js';

puppeteer.use(StealthPlugin());

async function crearCuentaInstagram(proxy) {
  const fingerprint = generateAdaptiveFingerprint() || {
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
    screen: { width: 1920, height: 1080 }
  };

  const nombre = generarNombreCompleto();
  const username = generarNombreUsuario();
  const email = `${username.replace(/[^a-zA-Z0-9]/g, '')}@kraveapi.xyz`;
  const password = `Pass${Math.random().toString(36).slice(2, 10)}`;

  let proxyUrl = '';
  try {
    proxyUrl = proxy.auth
      ? `http://${encodeURIComponent(proxy.auth.username)}:${encodeURIComponent(proxy.auth.password)}@${proxy.ip}:${proxy.port}`
      : `http://${proxy.ip}:${proxy.port}`;
  } catch {
    console.error('❌ Error construyendo proxy URL');
    return {
      usuario: '',
      email: '',
      password: '',
      proxy: `${proxy.ip}:${proxy.port}`,
      status: 'failed',
      error: 'Proxy malformado'
    };
  }

  // Validación extra de formato
  if (!proxyUrl.startsWith('http://') && !proxyUrl.startsWith('socks5://')) {
    console.error(`❌ Proxy URL inválida: ${proxyUrl}`);
    return {
      usuario: '',
      email: '',
      password: '',
      proxy: `${proxy.ip}:${proxy.port}`,
      status: 'failed',
      error: 'Proxy URL inválida'
    };
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: process.env.HEADLESS === 'true',
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
      args: [
        `--proxy-server=${proxyUrl}`,
        '--enable-async-dns',
        '--disable-quic',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ],
      ignoreHTTPSErrors: true
    });

    const page = await browser.newPage();

    if (proxy.auth) {
      await page.authenticate({
        username: proxy.auth.username,
        password: proxy.auth.password
      });
    }

    await page.setUserAgent(fingerprint.userAgent);
    await page.setViewport({
      width: fingerprint.screen?.width || 1920,
      height: fingerprint.screen?.height || 1080
    });

    if (proxy.auth) {
      await page.setExtraHTTPHeaders({
        'Proxy-Authorization': `Basic ${Buffer.from(`${proxy.auth.username}:${proxy.auth.password}`).toString('base64')}`
      });
    }

    console.log(`✅ Creando cuenta: @${username} usando ${proxy.ip}:${proxy.port}`);
    await page.goto('https://www.instagram.com/accounts/emailsignup/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await page.waitForSelector('input[name="emailOrPhone"]', { visible: true });

    await page.type('input[name="emailOrPhone"]', email, { delay: 50 + Math.random() * 100 });
    await page.waitForTimeout(1000);
    await page.type('input[name="fullName"]', nombre, { delay: 40 + Math.random() * 80 });
    await page.waitForTimeout(800);
    await page.type('input[name="username"]', username, { delay: 60 + Math.random() * 90 });
    await page.waitForTimeout(1200);
    await page.type('input[name="password"]', password, { delay: 30 + Math.random() * 70 });
    await page.waitForTimeout(1500);

    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });

    const currentUrl = page.url();
    if (currentUrl.includes('/onboarding')) {
      console.log(`🎉 Cuenta creada: @${username}`);
      await browser.close();
      return {
        usuario: username,
        email,
        password,
        proxy: `${proxy.ip}:${proxy.port}`,
        status: 'created'
      };
    }

    throw new Error('No se llegó a la página de onboarding después del registro');
  } catch (error) {
    console.error(`🔥 Error creando cuenta @${username}: ${error.message}`);
    
    let captchaExists = false;
    try {
      captchaExists = await browser?.pages()?.[0]?.$('iframe[title*="recaptcha"]') !== null;
    } catch {}

    if (captchaExists) {
      console.error('⚠️ CAPTCHA detectado');
    }

    if (browser) await browser.close();

    return {
      usuario: '',
      email: '',
      password: '',
      proxy: `${proxy.ip}:${proxy.port}`,
      status: 'failed',
      error: error.message
    };
  }
}

export default crearCuentaInstagram;