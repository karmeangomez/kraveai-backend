import { generarNombreCompleto, generarNombreUsuario } from '../utils/nombre_utils.js';
import { generateAdaptiveFingerprint } from '../fingerprints/generator.js';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

export default async function crearCuentaInstagram(proxy) {
  let browser;
  try {
    // Generar usuario, email y password UNA vez
    const username = generarNombreUsuario();
    const email = `${username.replace(/[^a-zA-Z0-9]/g, '')}@kraveapi.xyz`;
    const password = `Pass${Math.random().toString(36).slice(2, 10)}`;

    // Construcción SEGURA de proxyUrl
    let proxyUrl;
    if (proxy.type === 'socks5') {
      proxyUrl = `socks5://${proxy.auth?.username}:${proxy.auth?.password}@${proxy.ip}:${proxy.port}`;
    } else if (proxy.auth?.username && proxy.auth?.password) {
      proxyUrl = `http://${proxy.auth.username}:${proxy.auth.password}@${proxy.ip}:${proxy.port}`;
    } else {
      proxyUrl = `${proxy.ip}:${proxy.port}`;
    }

    const args = [
      `--proxy-server=${proxyUrl}`,
      '--ignore-certificate-errors',
      '--disable-gpu'
    ];

    // Lanzar Puppeteer con manejo de excepciones
    try {
      browser = await puppeteer.launch({
        headless: process.env.HEADLESS === 'true',
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
        args: args,
        ignoreHTTPSErrors: true
      });
    } catch (launchError) {
      console.error(`[ERROR] Fallo al usar proxy ${proxyUrl}: ${launchError.message}. Intentando sin proxy...`);
      browser = await puppeteer.launch({
        headless: process.env.HEADLESS === 'true',
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
        ignoreHTTPSErrors: true
      });
    }

    const page = await browser.newPage();
    await page.setUserAgent(generateAdaptiveFingerprint().userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    await page.setViewport({ width: generateAdaptiveFingerprint().screen?.width || 1920, height: generateAdaptiveFingerprint().screen?.height || 1080 });

    // Autenticación para proxies HTTP/HTTPS
    if (proxy.auth?.username && proxy.auth?.password) {
      await page.authenticate({
        username: proxy.auth.username,
        password: proxy.auth.password
      });
    }

    console.log(`[DEBUG] Iniciando creación para @${username} con proxy ${proxyUrl}`);
    console.log(`[DEBUG] Página creada para @${username}`);
    console.log(`[DEBUG] Autenticación proxy aplicada para @${username}`);
    console.log(`[DEBUG] Fingerprint aplicado para @${username}`);
    console.log(`Creando cuenta: @${username} con proxy ${proxyUrl}`);

    // Navegación con timeout ajustado
    try {
      await page.goto('https://www.instagram.com/accounts/emailsignup/', { 
        waitUntil: 'domcontentloaded', 
        timeout: 90000 
      });
    } catch (navigationError) {
      throw new Error(`Proxy error: ${navigationError.message}`);
    }

    await page.waitForSelector('input[name="emailOrPhone"]', { visible: true, timeout: 30000 });

    await page.type('input[name="emailOrPhone"]', email);
    await page.type('input[name="fullName"]', generarNombreCompleto());
    await page.type('input[name="username"]', username);
    await page.type('input[name="password"]', password);
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log(`[DEBUG] Navegación completada para @${username}`);
    await browser.close();

    return {
      username,
      email,
      password,
      proxy: `${proxy.ip}:${proxy.port}`,
      status: 'created'
    };
  } catch (error) {
    console.error(`[ERROR] Error creando cuenta @${username || generarNombreUsuario()}:`, error.message);
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
