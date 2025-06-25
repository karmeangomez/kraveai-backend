// src/accounts/crearCuentaInstagram.js
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import ProxyRotationSystem from '../proxies/proxyRotationSystem.js';
import emailManager from '../email/emailManager.js';
import { generateLatinoName, generateLatinoUsername } from '../utils/nombre_utils.js';
import { humanType, randomDelay, moveMouse } from '../utils/humanActions.js';
import { generateAdaptiveFingerprint } from '../fingerprints/generator.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

puppeteer.use(StealthPlugin());
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Bandera para inicializar el sistema de proxies solo una vez
let proxySystemInitialized = false;

async function safeInteract(page, selector, action, value = '') {
  try {
    await page.waitForSelector(selector, { timeout: 10000 });
    await action(page, selector, value);
    return true;
  } catch (e) {
    console.error(`⚠️ Error con selector ${selector}: ${e.message}`);
    return false;
  }
}

export default async function crearCuentaInstagram(puppeteerConfig = {}) {
  // Inicializar sistema de proxies solo una vez
  if (!proxySystemInitialized) {
    await ProxyRotationSystem.initialize();
    proxySystemInitialized = true;
    console.log('✅ Sistema de proxies inicializado');
  }

  const nombreCompleto = generateLatinoName();
  const username = generateLatinoUsername();
  const password = `Insta@${Math.floor(Math.random() * 10000)}`;

  // Obtener proxy usando el nuevo sistema
  const proxy = ProxyRotationSystem.getNextProxy();
  if (!proxy) throw new Error('Proxy no disponible');

  const proxyParts = proxy.proxy.split(':');
  const ip = proxyParts[0];
  const port = proxyParts[1];
  const user = proxyParts[2];
  const pass = proxyParts[3];

  const proxyStr = user && pass 
      ? `http://${user}:${pass}@${ip}:${port}`
      : `http://${ip}:${port}`;

  // Generar fingerprint compatible con la ubicación del proxy
  const fingerprint = generateAdaptiveFingerprint(proxy.country || 'MX');

  let browser;
  try {
    const email = await emailManager.getRandomEmail();

    browser = await puppeteer.launch({
      ...puppeteerConfig, // Usar configuración externa
      args: [
        `--proxy-server=${proxyStr}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        `--lang=${fingerprint.language.split(',')[0].split('-')[0]}`
      ],
      defaultViewport: {
        width: fingerprint.resolution.width,
        height: fingerprint.resolution.height
      }
    });

    const page = await browser.newPage();
    
    // Aplicar fingerprint completo
    await page.setUserAgent(fingerprint.userAgent);
    await page.evaluateOnNewDocument((timezone) => {
      Object.defineProperty(Intl, 'DateTimeFormat', {
        value: () => new Intl.DateTimeFormat('en-US', { timeZone: timezone })
      });
    }, fingerprint.timezone);
    
    // Bloquear recursos innecesarios
    await page.setRequestInterception(true);
    page.on('request', req => {
      const blockTypes = ['image', 'stylesheet', 'font'];
      if (blockTypes.includes(req.resourceType())) req.abort();
      else req.continue();
    });

    // Navegar a Instagram
    await page.goto('https://www.instagram.com/accounts/emailsignup/', { 
      timeout: 60000,
      waitUntil: 'domcontentloaded'
    });

    // Completar formulario
    await randomDelay(1000, 3000);
    if (!(await safeInteract(page, 'input[name="emailOrPhone"]', humanType, email))) return null;
    await randomDelay(500, 1500);
    if (!(await safeInteract(page, 'input[name="fullName"]', humanType, nombreCompleto))) return null;
    await randomDelay(500, 1500);
    if (!(await safeInteract(page, 'input[name="username"]', humanType, username))) return null;
    await randomDelay(500, 1500);
    if (!(await safeInteract(page, 'input[name="password"]', humanType, password))) return null;
    
    // Simular comportamiento humano
    await moveMouse(page);
    await randomDelay(2000, 4000);

    // Enviar formulario
    if (!(await safeInteract(page, 'button[type="submit"]', async (p, s) => p.click(s)))) return null;
    await page.waitForTimeout(5000);

    // Manejar verificación por email
    const codeInput = await page.$('input[name="email_confirmation_code"]');
    if (codeInput) {
      const code = await emailManager.getVerificationCode(email);
      if (!code) throw new Error('Código de verificación no recibido');
      
      await safeInteract(page, 'input[name="email_confirmation_code"]', humanType, code);
      await randomDelay(2000, 4000);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(5000);
    }

    // Verificar cuenta creada
    const profileUrl = `https://www.instagram.com/${username}/`;
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    const isProfileVisible = await page.evaluate(() => {
      return document.querySelector('h2')?.textContent?.includes('¿No has encontrado la cuenta que estabas buscando?') === false;
    });

    if (!isProfileVisible) throw new Error('Cuenta creada no es pública');

    // Guardar cookies
    const cookies = await page.cookies();
    const cookiesDir = path.join(__dirname, '../cookies');
    if (!fs.existsSync(cookiesDir)) fs.mkdirSync(cookiesDir);
    
    const cookiesPath = path.join(cookiesDir, `${username}.json`);
    fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));

    // Guardar cuenta
    const nuevaCuenta = {
      username,
      password,
      email,
      proxy: proxyStr,
      createdAt: new Date().toISOString(),
      status: 'created',
      proxyScore: proxy.score,
      latency: proxy.latency,
      country: proxy.country || 'XX',
      countryName: proxy.countryName || 'Unknown',
      region: proxy.region || 'Unknown',
      city: proxy.city || 'Unknown'
    };
    
    const cuentasPath = path.join(__dirname, '../cuentas_creadas.json');
    const cuentas = fs.existsSync(cuentasPath)
      ? JSON.parse(fs.readFileSync(cuentasPath, 'utf8'))
      : [];
    
    cuentas.push(nuevaCuenta);
    fs.writeFileSync(cuentasPath, JSON.stringify(cuentas, null, 2));

    console.log(`✅ Cuenta @${username} creada con proxy ${ip} (${proxy.country || 'XX'})`);
    return nuevaCuenta;
  } catch (error) {
    console.error(`❌ Error creando cuenta: ${error.message}`);
    
    // Guardar error en log
    const logsDir = path.join(__dirname, '../logs');
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir);
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      username: username || 'unknown',
      error: error.message,
      proxy: proxyStr || 'none',
      country: proxy?.country || 'XX'
    };
    
    const errorLogPath = path.join(logsDir, 'error_log.json');
    const errorLog = fs.existsSync(errorLogPath)
      ? JSON.parse(fs.readFileSync(errorLogPath, 'utf8'))
      : [];
    
    errorLog.push(logEntry);
    fs.writeFileSync(errorLogPath, JSON.stringify(errorLog, null, 2));
    
    // Capturar screenshot si es posible
    if (browser) {
      try {
        const pages = await browser.pages();
        if (pages[0]) {
          const screenshotPath = path.join(logsDir, `error_${Date.now()}.png`);
          await pages[0].screenshot({ path: screenshotPath });
        }
      } catch (screenshotError) {
        console.error('⚠️ Error capturando screenshot:', screenshotError.message);
      }
    }

    return {
      username: username || 'unknown',
      email: email || 'unknown',
      password: password || 'unknown',
      proxy: proxyStr || 'none',
      status: 'failed',
      error: error.message,
      proxyScore: proxy?.score,
      latency: proxy?.latency,
      country: proxy?.country || 'XX'
    };
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (browserError) {
        console.error('⚠️ Error cerrando browser:', browserError.message);
      }
    }
  }
}
