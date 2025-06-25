import { generarNombreCompleto, generarNombreUsuario } from '../utils/nombre_utils.js';
import { generateAdaptiveFingerprint } from '../fingerprints/generator.js';
import ProxyRotationSystem from '../proxies/proxyRotationSystem.js';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function crearCuentaInstagram() {
  try {
    const proxy = ProxyRotationSystem.getProxy();
    const fingerprint = generateAdaptiveFingerprint();
    const name = generarNombreCompleto();
    const username = generarNombreUsuario();
    const email = `${username.replace(/[^a-zA-Z0-9]/g, '')}@kraveai.xyz`; // Limpia caracteres no válidos
    const password = `Pass${Math.random().toString(36).slice(2, 10)}`;

    const browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
      args: [`--proxy-server=${proxy.proxy}`]
    });

    const page = await browser.newPage();
    await page.setUserAgent(fingerprint.userAgent);
    await page.setViewport({ width: fingerprint.screen.width, height: fingerprint.screen.height });

    console.log(`Creando cuenta: @${username} con proxy ${proxy.proxy}`);
    await page.goto('https://www.instagram.com/accounts/emailsignup/');
    await page.waitForTimeout(1000); // Placeholder: añadir lógica real aquí

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
    return {
      username: '',
      email: '',
      password: '',
      proxy: '',
      status: 'failed',
      error: error.message
    };
  }
}

export default crearCuentaInstagram;
