// 📁 src/accounts/crearCuentaInstagram.js
import puppeteer from 'puppeteer';
import { v4 as uuidv4 } from 'uuid';

export default async (proxy) => {
  const browser = await puppeteer.launch({
    headless: process.env.HEADLESS === 'true',
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    args: [
      // ⭐⭐ USAR AUTENTICACIÓN EN URL ⭐⭐
      `--proxy-server=socks5://${proxy.auth.username}:${proxy.auth.password}@${proxy.ip}:${proxy.port}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process'
    ]
  });

  const page = await browser.newPage();
  
  // ⭐⭐ AUTENTICACIÓN ADICIONAL (requerida para algunos proxies) ⭐⭐
  await page.authenticate({
    username: proxy.auth.username,
    password: proxy.auth.password
  });

  // Configuración esencial
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.64 Safari/537.36');
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9'
  });

  try {
    console.log(`✅ Creando cuenta usando ${proxy.ip}:${proxy.port}`);
    await page.goto('https://www.instagram.com/accounts/emailsignup/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // Generar datos aleatorios
    const username = `user_${Math.random().toString(36).substring(2, 8)}`;
    const email = `${uuidv4()}@gmail.com`;
    const password = `P@ss${Math.random().toString(36).substring(2, 10)}`;

    // Rellenar formulario
    await page.type('input[name="emailOrPhone"]', email);
    await page.type('input[name="fullName"]', 'Instagram User');
    await page.type('input[name="username"]', username);
    await page.type('input[name="password"]', password);
    
    // Enviar formulario
    await Promise.all([
      page.waitForNavigation(),
      page.click('button[type="submit"]')
    ]);

    await browser.close();
    return { usuario: username, password };
  } catch (error) {
    await browser.close();
    throw new Error(`net::${error.message.split('net::')[1] || error.message}`);
  }
};
