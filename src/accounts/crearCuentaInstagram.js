// src/accounts/crearCuentaInstagram.js
import puppeteer from 'puppeteer';
import { v4 as uuidv4 } from 'uuid';

const generateRandomData = () => {
  // ... (código existente sin cambios) ...
};

export default async (proxy) => {
  const { username, email, password, fullName } = generateRandomData();
  
  // 1. CAMBIOS CRÍTICOS EN CONFIGURACIÓN DE PROXY
  const proxyUrl = `http://${proxy.auth.username}:${proxy.auth.password}@${proxy.ip}:${proxy.port}`;
  
  const browser = await puppeteer.launch({
    headless: process.env.HEADLESS === 'true',
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    args: [
      // Usar proxy HTTP (SOCKS no funciona en ARM)
      `--proxy-server=${proxyUrl}`,
      
      // Añadir parámetros específicos para ARM
      '--enable-async-dns',
      '--disable-quic',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-blink-features=AutomationControlled',
      '--lang=en-US,en'
    ],
    ignoreHTTPSErrors: true
  });

  const page = await browser.newPage();
  
  // 2. AUTENTICACIÓN ADICIONAL PARA PROXIES HTTP
  await page.authenticate({
    username: proxy.auth.username,
    password: proxy.auth.password
  });

  // 3. CONFIGURACIÓN DE ENCABEZADOS MEJORADA
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'X-Proxy-Country': proxy.country || 'us',
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
  });

  // 4. SOLUCIÓN PARA ERR_NO_SUPPORTED_PROXIES
  await page.setRequestInterception(true);
  page.on('request', request => {
    // Bypass para errores de proxy
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      request.continue({ url: request.url().replace('https', 'http') });
    } else {
      request.continue();
    }
  });

  try {
    console.log(`🌐 Navegando a Instagram con proxy ${proxy.country}/${proxy.city}`);
    
    // 5. USAR HTTP EN LUGAR DE HTTPS (SOLUCIÓN TEMPORAL)
    await page.goto('http://www.instagram.com/accounts/emailsignup/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // ... (resto del código existente sin cambios) ...

  } catch (error) {
    // 6. MANEJO MEJORADO DE ERRORES
    if (error.message.includes('ERR_NO_SUPPORTED_PROXIES')) {
      throw new Error('Proxy no compatible con Chromium ARM');
    }
    
    // Capturar captcha si aparece
    const captchaExists = await page.$('iframe[title*="recaptcha"]');
    if (captchaExists) {
      throw new Error('CAPTCHA detectado');
    }
    
    throw new Error(error.message.split('\n')[0]);
  } finally {
    await browser.close();
  }
};
