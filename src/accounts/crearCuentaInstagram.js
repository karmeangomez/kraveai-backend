// 📁 src/accounts/crearCuentaInstagram.js
import { generarNombreCompleto, generarNombreUsuario } from '../utils/nombre_utils.js';
import { generateAdaptiveFingerprint } from '../fingerprints/generator.js';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

export default async function crearCuentaInstagram(proxy) {
  const fingerprint = generateAdaptiveFingerprint() || {
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
    screen: { width: 1920, height: 1080 }
  };

  const name = generarNombreCompleto();
  const username = generarNombreUsuario();
  const email = `${username.replace(/[^a-zA-Z0-9]/g, '')}@kraveai.xyz`;
  const password = `Pass${Math.random().toString(36).slice(2, 10)}`;

  const proxyUrl = proxy.auth
    ? `http://${proxy.auth.username}:${proxy.auth.password}@${proxy.ip}:${proxy.port}`
    : `http://${proxy.ip}:${proxy.port}`;

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

    console.log(`✅ Creando cuenta: @${username} usando ${proxy.ip}:${proxy.port}`);
    await page.goto('https://www.instagram.com/accounts/emailsignup/');
    await new Promise(resolve => setTimeout(resolve, 1000)); // simulación humana

    await browser.close();

    return {
      username,
      email,
      password,
      proxy: `${proxy.ip}:${proxy.port}`,
      status: 'created'
    };
  } catch (error) {
    console.error(`🔥 Error creando cuenta @${username}:`, error.message);

    return {
      username: '',
      email: '',
      password: '',
      proxy: `${proxy.ip}:${proxy.port}`,
      status: 'failed',
      error: error.message
    };
  }
}
