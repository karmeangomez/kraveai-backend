import { generarNombreCompleto, generarNombreUsuario } from '../utils/nombre_utils.js';
import { generateAdaptiveFingerprint } from '../fingerprints/generator.js';
import ProxyRotationSystem from '../proxies/proxyRotationSystem.js';
import { blacklistProxy } from '../proxies/proxyBlacklistManager.js';
import rotateTorIP from '../proxies/torController.js';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function crearCuentaInstagram() {
  const fingerprint = generateAdaptiveFingerprint();
  const name = generarNombreCompleto();
  const username = generarNombreUsuario();
  const email = `${username.replace(/[^a-zA-Z0-9]/g, '')}@kraveai.xyz`;
  const password = `Pass${Math.random().toString(36).slice(2, 10)}`;

  const proxy = ProxyRotationSystem.getNextProxy();
  const proxyArg = proxy.proxy.startsWith('socks5://')
    ? proxy.proxy
    : `http://${proxy.proxy}`;

  try {
    if (proxy.tor) await rotateTorIP();

    const browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
      args: [`--proxy-server=${proxyArg}`]
    });

    const page = await browser.newPage();

    // Si el proxy tiene autenticación
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

    console.log(`Creando cuenta: @${username} con proxy ${proxy.proxy}`);
    await page.goto('https://www.instagram.com/accounts/emailsignup/');
    await page.waitForTimeout(1000); // Aquí va el flujo real

    await browser.close();

    return {
      username,
      email,
      password,
      proxy: proxy.proxy,
      status: 'created'
    };
  } catch (error) {
    console.error('Error creando cuenta:', error.message);

    // Blacklist si el proxy falló por auth inválida
    if (error.message.includes('ERR_INVALID_AUTH_CREDENTIALS')) {
      blacklistProxy(proxy.proxy);
    }

    return {
      username: '',
      email: '',
      password: '',
      proxy: proxy.proxy,
      status: 'failed',
      error: error.message
    };
  }
}

export default crearCuentaInstagram;
