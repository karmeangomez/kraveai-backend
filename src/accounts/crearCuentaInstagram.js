import { generarNombreCompleto, generarNombreUsuario } from '../utils/nombre_utils.js';
import { generateAdaptiveFingerprint } from '../fingerprints/generator.js';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

export default async function crearCuentaInstagram(proxy) {
  let browser;
  try {
    const fingerprint = generateAdaptiveFingerprint() || { 
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36', 
      screen: { width: 1920, height: 1080 } 
    };

    // Construir proxyUrl con protocolo explícito
    let proxyUrl = proxy.auth 
      ? `http://${proxy.auth.username}:${proxy.auth.password}@${proxy.ip}:${proxy.port}`
      : `http://${proxy.ip}:${proxy.port}`;
    let args = [
      `--proxy-server=${proxyUrl}`,
      '--ignore-certificate-errors',
      '--enable-features=NetworkService',
      '--disable-gpu'
    ];

    // Intentar lanzar Puppeteer con proxy
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
    await page.setUserAgent(fingerprint.userAgent);
    await page.setViewport({ width: fingerprint.screen?.width || 1920, height: fingerprint.screen?.height || 1080 });

    // Autenticación adicional para proxies HTTP/HTTPS
    if (proxy.auth) {
      await page.authenticate({
        username: proxy.auth.username,
        password: proxy.auth.password
      });
      await page.setExtraHTTPHeaders({
        'Proxy-Authorization': `Basic ${Buffer.from(`${proxy.auth.username}:${proxy.auth.password}`).toString('base64')}`
      });
    }

    console.log(`[DEBUG] Iniciando creación para @${generarNombreUsuario()} con proxy ${proxy.ip}:${proxy.port}`);
    console.log(`[DEBUG] Página creada para @${generarNombreUsuario()}`);
    console.log(`[DEBUG] Autenticación proxy aplicada para @${generarNombreUsuario()}`);
    console.log(`[DEBUG] Fingerprint aplicado para @${generarNombreUsuario()}`);
    console.log(`Creando cuenta: @${generarNombreUsuario()} con proxy ${proxy.ip}:${proxy.port}`);

    // Intentar navegar con manejo de errores
    try {
      await page.goto('https://www.instagram.com/accounts/emailsignup/', { waitUntil: 'networkidle2', timeout: 60000 }); // Aumentado timeout
    } catch (navigationError) {
      throw new Error(`Proxy error: ${navigationError.message}`);
    }

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
      proxy: `${proxy.ip}:${proxy.port}`,
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
