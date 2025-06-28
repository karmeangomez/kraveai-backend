import puppeteer from 'puppeteer';
import { v4 as uuidv4 } from 'uuid';

// Función para generar datos aleatorios
const generateRandomData = () => {
  const randomString = Math.random().toString(36).substring(2, 8);
  const domains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
  return {
    username: `user_${randomString}`,
    email: `email_${randomString}@${domains[Math.floor(Math.random() * domains.length)]}`,
    password: `P@ss${randomString}${Math.floor(Math.random() * 100)}`,
    fullName: `User ${randomString.toUpperCase()}`
  };
};

export default async (proxy) => {
  const { username, email, password, fullName } = generateRandomData();
  const browser = await puppeteer.launch({
    headless: process.env.HEADLESS === 'true',
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    args: [
      `--proxy-server=socks5://${proxy.auth.username}:${proxy.auth.password}@${proxy.ip}:${proxy.port}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-blink-features=AutomationControlled',
      '--lang=en-US,en'
    ],
    ignoreHTTPSErrors: true
  });

  const page = await browser.newPage();
  
  // Autenticación adicional
  await page.authenticate({
    username: proxy.auth.username,
    password: proxy.auth.password
  });

  // Configuración de navegación
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1');
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'X-Proxy-Country': proxy.country || 'us'
  });

  // Evitar detección como bot
  await page.evaluateOnNewDocument(() => {
    delete navigator.__proto__.webdriver;
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3]
    });
  });

  try {
    console.log(`🌐 Navegando a Instagram con proxy ${proxy.country}/${proxy.city}`);
    await page.goto('https://www.instagram.com/accounts/emailsignup/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // Simular interacción humana
    await page.waitForTimeout(2000 + Math.random() * 3000);
    
    // Rellenar formulario
    await page.type('input[name="emailOrPhone"]', email, { delay: 50 + Math.random() * 100 });
    await page.waitForTimeout(1000);
    
    await page.type('input[name="fullName"]', fullName, { delay: 40 + Math.random() * 80 });
    await page.waitForTimeout(800);
    
    await page.type('input[name="username"]', username, { delay: 60 + Math.random() * 90 });
    await page.waitForTimeout(1200);
    
    await page.type('input[name="password"]', password, { delay: 30 + Math.random() * 70 });
    await page.waitForTimeout(1500);
    
    // Enviar formulario
    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);

    // Verificar creación exitosa
    const currentUrl = await page.url();
    if (currentUrl.includes('/onboarding')) {
      console.log('🎉 Cuenta creada exitosamente');
      return { usuario: username, password, email };
    }

    throw new Error('Fallo en creación de cuenta');
  } catch (error) {
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
