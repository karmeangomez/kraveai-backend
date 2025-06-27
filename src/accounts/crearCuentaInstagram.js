import { generarNombreCompleto, generarNombreUsuario } from '../utils/nombre_utils.js';
import { generateAdaptiveFingerprint } from '../fingerprints/generator.js';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import ProxyPlugin from 'puppeteer-extra-plugin-proxy';

puppeteer.use(StealthPlugin());
puppeteer.use(ProxyPlugin());

export default async function crearCuentaInstagram(proxy) {
  let browser;
  try {
    const fingerprint = generateAdaptiveFingerprint() || { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36', screen: { width: 1920, height: 1080 } };

    let proxyConfig = proxy.proxy;
    if (proxy.auth) {
      proxyConfig = `${proxy.proxy.split(':')[0]}://${proxy.auth.username}:${proxy.auth.password}@${proxy.proxy.split(':')[1]}`; // Ajuste para autenticación
    }

    browser = await puppeteer.launch({
      headless: process.env.HEADLESS === 'true',
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
      args: ['--no-sandbox', '--disable-setuid-sandbox'], // Opciones para Raspberry Pi
      proxy: proxyConfig // Usar plugin de proxy
    });

    const page = await browser.newPage();
    await page.setUserAgent(fingerprint.userAgent);
    await page.setViewport({ width: fingerprint.screen?.width || 1920, height: fingerprint.screen?.height || 1080 });

    console.log(`[DEBUG] Iniciando creación para @${generarNombreUsuario()} con proxy ${proxy.proxy}`);
    console.log(`[DEBUG] Página creada para @${generarNombreUsuario()}`);
    console.log(`[DEBUG] Autenticación proxy aplicada para @${generarNombreUsuario()}`);
    console.log(`[DEBUG] Fingerprint aplicado para @${generarNombreUsuario()}`);
    console.log(`Creando cuenta: @${generarNombreUsuario()} con proxy ${proxy.proxy}`);

    await page.goto('https://www.instagram.com/accounts/emailsignup/', { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('input[name="emailOrPhone"]', { visible: true, timeout: 30000 });

    const username = generarNombreUsuario();
    await page.type('input[name="emailOrPhone"]', `${username.replace(/[^a-zA-Z0-9]/g, '')}@kraveapi.xyz`);
    await page.type('input[name="fullName"]', generarNombreCompleto());
    await page.type('input[name="username"]', username);
    await page.type('input[name="password"]', `Pass${Math.random().toString(36).slice(2, 10)}`);
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log(`[DEBUG] Navegación completada para @${username}`);
    await browser.close();

    return {
      username,
      email: `${username.replace(/[^a-zA-Z0-9]/g, '')}@kraveapi.xyz`,
      password: `Pass${Math.random().toString(36).slice(2, 10)}`,
      proxy: proxy.proxy,
      status: 'created'
    };
  } catch (error) {
    console.error(`[ERROR] Error creando cuenta @${generarNombreUsuario()}:`, error.message);
    if (browser) await browser.close();
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
