// ... (todo tu código existente permanece igual) ...

export async function crearCuentaTest() {
  const testConfig = {
    proxy: {
      ip: 'p.webshare.io',
      port: 80,
      auth: {
        username: process.env.WEBSHARE_RESIDENTIAL_USER,
        password: process.env.WEBSHARE_RESIDENTIAL_PASS
      },
      type: 'http',
      source: 'webshare_residential'
    },
    fingerprint: generateAdaptiveFingerprint(),
    usarTor: false
  };

  let browser;
  try {
    console.log("🧪 Iniciando prueba de creación de cuenta...");
    
    // Configuración mínima para prueba
    browser = await puppeteer.launch({
      headless: process.env.HEADLESS === 'true',
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: [
        `--proxy-server=http://${testConfig.proxy.ip}:${testConfig.proxy.port}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--lang=en-US,en'
      ],
      ignoreHTTPSErrors: true
    });

    const page = await browser.newPage();
    
    // Autenticación de proxy
    await page.authenticate({
      username: testConfig.proxy.auth.username,
      password: testConfig.proxy.auth.password
    });

    await page.setUserAgent(testConfig.fingerprint.userAgent);
    await page.setViewport({
      width: testConfig.fingerprint.screen.width,
      height: testConfig.fingerprint.screen.height,
      deviceScaleFactor: 1
    });

    // Navegar a Instagram
    await page.goto('https://www.instagram.com/accounts/emailsignup/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Verificar elementos críticos
    const selectors = [
      'input[name="emailOrPhone"]',
      'input[name="fullName"]',
      'input[name="username"]',
      'input[name="password"]',
      'button[type="submit"]'
    ];
    
    let missingSelectors = [];
    for (const selector of selectors) {
      const exists = await page.$(selector).catch(() => null);
      if (!exists) missingSelectors.push(selector);
    }
    
    if (missingSelectors.length > 0) {
      const screenshot = await page.screenshot({ encoding: 'base64' });
      return {
        success: false,
        message: `❌ Selectores faltantes: ${missingSelectors.join(', ')}`,
        screenshot
      };
    }
    
    // Completar formulario básico
    await page.type('input[name="emailOrPhone"]', 'test@example.com', { delay: 50 });
    await page.type('input[name="fullName"]', 'Test User', { delay: 50 });
    await page.type('input[name="username"]', 'testuser_' + Math.random().toString(36).substring(2, 8), { delay: 50 });
    await page.type('input[name="password"]', 'TestPassword123!', { delay: 50 });
    
    // Tomar captura de estado
    const screenshot = await page.screenshot({ encoding: 'base64' });
    
    return {
      success: true,
      message: "✅ Prueba exitosa: Formulario básico completado",
      screenshot
    };
    
  } catch (error) {
    let screenshot = '';
    if (browser) {
      const page = await browser.newPage();
      screenshot = await page.screenshot({ encoding: 'base64' }).catch(() => '');
    }
    return {
      success: false,
      message: `❌ Error en prueba: ${error.message}`,
      screenshot
    };
  } finally {
    if (browser) await browser.close();
  }
}
