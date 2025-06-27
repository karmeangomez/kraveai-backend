import { generarNombreCompleto, generarNombreUsuario } from '../utils/nombre_utils.js';
import { generateAdaptiveFingerprint } from '../fingerprints/generator.js';
import ProxyRotationSystem from '../proxies/proxyRotationSystem.js';
import { blacklistProxy } from '../proxies/proxyBlacklistManager.js';
import rotateTorIP from '../proxies/torController.js';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import ionosMail from '../email/ionosMail.js'; // Ruta y nombre corregidos

puppeteer.use(StealthPlugin());

const ionosMail = new ionosMail(); // Instancia con el nombre de clase correcto

async function crearCuentaInstagram() {
  const fingerprint = generateAdaptiveFingerprint();
  const name = generarNombreCompleto();
  const username = generarNombreUsuario();
  let email, password;

  if (ionosMail.isActive()) {
    email = await ionosMail.getEmailAddress();
    password = `Pass${Math.random().toString(36).slice(2, 10)}`;
  } else {
    email = `${username.replace(/[^a-zA-Z0-9]/g, '')}@kraveapi.xyz`;
    password = `Pass${Math.random().toString(36).slice(2, 10)}`;
  }

  const proxy = ProxyRotationSystem.getNextProxy();
  const proxyArg = proxy.proxy.startsWith('socks5://')
    ? proxy.proxy
    : `http://${proxy.proxy}`;

  console.log(`[DEBUG] Iniciando creación para @${username} con proxy ${proxy.proxy}`);
  try {
    if (proxy.tor) await rotateTorIP();

    const browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
      args: [`--proxy-server=${proxyArg}`, '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();
    console.log(`[DEBUG] Página creada para @${username}`);

    if (proxy.auth) {
      await page.authenticate({
        username: proxy.auth.username,
        password: proxy.auth.password
      });
      console.log(`[DEBUG] Autenticación proxy aplicada para @${username}`);
    }

    await page.setUserAgent(fingerprint.userAgent);
    await page.setViewport({
      width: fingerprint.screen?.width || 1920,
      height: fingerprint.screen?.height || 1080
    });
    console.log(`[DEBUG] Fingerprint aplicado para @${username}`);

    console.log(`Creando cuenta: @${username} con proxy ${proxy.proxy}`);
    await page.goto('https://www.instagram.com/accounts/emailsignup/', { waitUntil: 'networkidle2' });
    console.log(`[DEBUG] Navegación completada para @${username}`);

    await page.waitForSelector('input[name="emailOrPhone"]', { timeout: 10000 });
    await page.type('input[name="emailOrPhone"]', email, { delay: 100 });
    await new Promise(resolve => setTimeout(resolve, 500));
    await page.type('input[name="fullName"]', name, { delay: 100 });
    await page.type('input[name="username"]', username, { delay: 100 });
    await page.type('input[name="password"]', password, { delay: 100 });
    await page.mouse.move(Math.random() * 1000, Math.random() * 1000);
    await new Promise(resolve => setTimeout(resolve, 1000));
    await page.click('button[type="submit"]');
    console.log(`[DEBUG] Formulario enviado para @${username}`);

    await new Promise(resolve => setTimeout(resolve, 5000));
    const pageContent = await page.content();
    console.log(`[DEBUG] Contenido de página capturado para @${username}`);

    const cookies = await page.cookies();
    fs.writeFileSync(`cookies_${username}.json`, JSON.stringify(cookies, null, 2));
    fs.writeFileSync(`page_${username}.html`, pageContent);
    console.log(`[DEBUG] Cookies y contenido guardados para @${username}`);

    if (pageContent.includes('checkpoint') || pageContent.includes('verification')) {
      console.log(`[DEBUG] Verificación requerida para @${username}`);
      let verificationCode = null;
      if (ionosMail.isActive()) {
        verificationCode = await ionosMail.waitForVerificationCode(60000);
        await page.waitForSelector('input[name="code"]', { timeout: 5000 }).catch(() => {});
        if (verificationCode && await page.$('input[name="code"]')) {
          await page.type('input[name="code"]', verificationCode, { delay: 100 });
          await page.click('button[type="submit"]');
          await new Promise(resolve => setTimeout(resolve, 3000));
          const newContent = await page.content();
          if (newContent.includes('checkpoint')) {
            console.log(`[DEBUG] Verificación falló para @${username}`);
            await browser.close();
            return {
              username,
              email,
              password,
              proxy: proxy.proxy,
              status: 'created_pending_verification',
              error: 'Requiere selfie u otra verificación'
            };
          }
        }
      }
    }

    await browser.close();
    console.log(`[DEBUG] Navegador cerrado para @${username}`);

    const verifyBrowser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
      args: [`--proxy-server=${proxyArg}`]
    });
    const verifyPage = await verifyBrowser.newPage();
    await verifyPage.goto('https://www.instagram.com');
    await verifyPage.type('input[name="username"]', email);
    await verifyPage.type('input[name="password"]', password);
    await verifyPage.click('button[type="submit"]');
    await new Promise(resolve => setTimeout(resolve, 3000));
    const verifyContent = await verifyPage.content();

    if (verifyContent.includes('login') || verifyContent.includes('checkpoint')) {
      await verifyPage.close();
      await verifyBrowser.close();
      return {
        username,
        email,
        password,
        proxy: proxy.proxy,
        status: 'created_pending_verification',
        error: 'Requiere verificación post-login'
      };
    }

    await verifyPage.close();
    await verifyBrowser.close();
    return {
      username,
      email,
      password,
      proxy: proxy.proxy,
      status: 'created'
    };
  } catch (error) {
    console.error(`[ERROR] Error creando cuenta @${username}:`, error.message);

    if (error.message.includes('ERR_INVALID_AUTH_CREDENTIALS')) {
      blacklistProxy(proxy.proxy);
      console.log(`[DEBUG] Proxy ${proxy.proxy} añadido a blacklist`);
    }

    await browser?.close().catch(() => {});
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
