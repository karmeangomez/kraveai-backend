import puppeteer from 'puppeteer';

export default async (proxy) => {
  const browser = await puppeteer.launch({
    headless: process.env.HEADLESS === 'true',
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    args: [
      `--proxy-server=socks5://${proxy.auth.username}:${proxy.auth.password}@${proxy.ip}:${proxy.port}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ]
  });

  const page = await browser.newPage();
  
  // Autenticación adicional
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

    // Generar datos aleatorios SIN UUID
    const randomString = () => Math.random().toString(36).substring(2, 10);
    const timestamp = Date.now().toString().substring(7);
    
    const username = `user_${randomString()}${timestamp}`;
    const email = `email_${randomString()}${timestamp}@gmail.com`;
    const password = `P@ss${randomString()}`;

    // Rellenar formulario
    await page.type('input[name="emailOrPhone"]', email);
    await page.type('input[name="fullName"]', 'Instagram User');
    await page.type('input[name="username"]', username);
    await page.type('input[name="password"]', password);
    
    // Enviar formulario
    await page.click('button[type="submit"]');
    
    // Esperar y verificar
    await page.waitForNavigation({timeout: 15000});
    const currentUrl = await page.url();
    
    if (!currentUrl.includes('/onboarding')) {
      throw new Error('Fallo en creación de cuenta');
    }

    await browser.close();
    return { usuario: username, password, email };
  } catch (error) {
    await browser.close();
    throw new Error(`Error en creación: ${error.message}`);
  }
};
