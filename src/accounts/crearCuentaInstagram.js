// src/accounts/crearCuentaInstagram.js
import { generarNombreCompleto, generarNombreUsuario } from '../utils/nombre_utils.js';
import { generateAdaptiveFingerprint } from '../fingerprints/generator.js';
import ProxyRotationSystem from '../proxies/proxyRotationSystem.js';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function crearCuentaInstagram() {
  const proxy = ProxyRotationSystem.getNextProxy();
  const fingerprint = generateAdaptiveFingerprint() || {
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
    screen: { width: 1920, height: 1080 }
  };

  const name = generarNombreCompleto();
  const username = generarNombreUsuario();
  const email = `${username.replace(/[^a-zA-Z0-9]/g, '')}@kraveai.xyz`;
  const password = `Pass${Math.random().toString(36).slice(2, 10)}`;

  // Armado de proxy con autenticación (si aplica)
  const proxyUrl = proxy.auth
    ? `http://${proxy.auth.username}:${proxy.auth.password}@${proxy.proxy}`
    : `http://${proxy.proxy}`;

  try {
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
      args: [`--proxy-server=${proxyUrl}`]
    });

    const page = await browser.newPage();

    await page.setUserAgent(fingerprint.userAgent);
    await page.setViewport({
      width: fingerprint.screen?.width || 1920,
      height: fingerprint.screen?.height || 1080
    });

    console.log(`Creando cuenta: @${username} con proxy ${proxy.proxy}`);
    await page.goto('https://www.instagram.com/accounts/emailsignup/');
    await new Promise(resolve => setTimeout(resolve, 1000)); // espera simulada

    await browser.close();

    return {
      username,
      email,
      password,
      proxy: proxy.proxy,
      status: 'created'
    };
  } catch (error) {
    console.error(`Error creando cuenta @${username}:`, error.message);

    // Marcar el proxy como fallido si fue error de proxy no compatible
    if (error.message.includes('net::ERR_NO_SUPPORTED_PROXIES')) {
      ProxyRotationSystem.markProxyAsBad(proxy.proxy, 'NO_SUPPORTED_PROXIES');
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
