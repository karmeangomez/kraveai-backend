// ✅ Versión final con soporte para SOCKS5 autenticados y fallback a Tor

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { generarNombreCompleto, generarNombreUsuario } from '../utils/nombre_utils.js';
import { generateAdaptiveFingerprint } from '../fingerprints/generator.js';
import { notifyTelegram } from '../utils/telegram_utils.js'; // ✅ Corregido aquí
import { validarProxySOCKS } from '../proxies/validator.js';
import { rotateTorIP } from '../proxies/torController.js';

puppeteer.use(StealthPlugin());

export default async function crearCuentaInstagram(proxy, usarTor = false) {
  const fingerprint = generateAdaptiveFingerprint();
  const nombre = generarNombreCompleto();
  const username = generarNombreUsuario();
  const email = `${username.replace(/[^a-zA-Z0-9]/g, '')}@kraveapi.xyz`;
  const password = `Krave${Math.random().toString(36).slice(2, 8)}!`;

  const proxyUrl = usarTor
    ? 'socks5://127.0.0.1:9050'
    : `socks5://${proxy.auth}:${proxy.ip}:${proxy.port}`;

  const proxyStr = usarTor ? 'Tor' : `${proxy.ip}:${proxy.port}`;

  let browser;
  try {
    if (!usarTor) {
      const esValido = await validarProxySOCKS(proxyUrl);
      if (!esValido) throw new Error(`Proxy inválido: ${proxyUrl}`);
    }

    browser = await puppeteer.launch({
      headless: false,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: [
        `--proxy-server=${proxyUrl}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--lang=en-US,en'
      ],
      ignoreHTTPSErrors: true
    });

    const page = await browser.newPage();
    await page.setUserAgent(fingerprint.userAgent);
    await page.setViewport({
      width: fingerprint.screen.width,
      height: fingerprint.screen.height,
      deviceScaleFactor: 1
    });

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9'
    });

    console.log(`🌐 Usando proxy: ${proxyStr}`);

    await page.goto('https://www.instagram.com/accounts/emailsignup/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await page.waitForSelector('input[name="emailOrPhone"]', { visible: true });
    await page.type('input[name="emailOrPhone"]', email, { delay: 100 });
    await page.type('input[name="fullName"]', nombre, { delay: 100 });
    await page.type('input[name="username"]', username, { delay: 100 });
    await page.type('input[name="password"]', password, { delay: 100 });

    // Aquí podrías continuar con el flujo de verificación, código, etc.

    console.log(`✅ Datos generados: ${username} / ${email} / ${password}`);

    await browser.close();
  } catch (error) {
    console.error('❌ Error al crear cuenta:', error.message);
    if (browser) await browser.close();
    if (!usarTor) {
      console.log('🔁 Reintentando con Tor como fallback...');
      await rotateTorIP();
      return crearCuentaInstagram(null, true);
    } else {
      await notifyTelegram(`❌ Falló incluso con Tor: ${error.message}`);
    }
  }
}
