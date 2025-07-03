import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { generarNombreCompleto, generarNombreUsuario } from '../utils/nombre_utils.js';
import { generateAdaptiveFingerprint } from '../fingerprints/generator.js';
import { notifyTelegram } from '../utils/telegram_utils.js';
import { validateProxy } from '../utils/validator.js';
import rotateTorIP from '../proxies/torController.js';

puppeteer.use(StealthPlugin());

export default async function crearCuentaInstagram(proxy, usarTor = false) {
  const fingerprint = generateAdaptiveFingerprint();
  const nombre = generarNombreCompleto();
  const username = generarNombreUsuario();
  const email = `${username.replace(/[^a-zA-Z0-9]/g, '')}@kraveapi.xyz`;
  const password = `Krave${Math.random().toString(36).slice(2, 8)}!`;

  const proxyStr = usarTor ? 'Tor' : `${proxy.ip}:${proxy.port}`;
  const proxyProtocol = usarTor ? 'socks5' : proxy.type || 'socks5';
  const proxyHost = usarTor ? '127.0.0.1' : proxy.ip;
  const proxyPort = usarTor ? 9050 : proxy.port;

  let browser;

  try {
    console.log(`🌐 Usando proxy: ${proxyStr}`);

    const esValido = await validateProxy(
      usarTor
        ? {
            ip: '127.0.0.1',
            port: 9050,
            auth: { username: '', password: '' },
            type: 'socks5'
          }
        : proxy
    );

    if (!esValido) {
      throw new Error(usarTor ? '⚠️ Tor no responde o está apagado' : `Proxy inválido: ${proxyStr}`);
    }

    browser = await puppeteer.launch({
      headless: false,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: [
        `--proxy-server=${proxyProtocol}://${proxyHost}:${proxyPort}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--lang=en-US,en'
      ],
      ignoreHTTPSErrors: true
    });

    const page = await browser.newPage();

    if (!usarTor && proxy?.auth?.username) {
      await page.authenticate({
        username: proxy.auth.username,
        password: proxy.auth.password
      });
    }

    await page.setUserAgent(fingerprint.userAgent);
    await page.setViewport({
      width: fingerprint.screen.width,
      height: fingerprint.screen.height,
      deviceScaleFactor: 1
    });

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9'
    });

    await page.goto('https://www.instagram.com/accounts/emailsignup/', {
      waitUntil: 'networkidle2',
      timeout: 45000
    });

    await page.waitForSelector('input[name="emailOrPhone"]', { visible: true });
    await page.type('input[name="emailOrPhone"]', email, { delay: 100 });
    await page.type('input[name="fullName"]', nombre, { delay: 100 });
    await page.type('input[name="username"]', username, { delay: 100 });
    await page.type('input[name="password"]', password, { delay: 100 });

    console.log(`✅ Cuenta generada: @${username} | ${email}`);

    await browser.close();
    return { usuario: username, password };
  } catch (error) {
    console.error('❌ Error al crear cuenta:', error.message);
    if (browser) await browser.close();

    if (!usarTor) {
      console.log('🔁 Reintentando con Tor como fallback...');
      await rotateTorIP();
      return crearCuentaInstagram(null, true);
    } else {
      await notifyTelegram(`❌ Falló incluso con Tor: ${error.message}`);
      return null;
    }
  }
}
