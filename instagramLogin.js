async function instagramLogin() {
  const username = process.env.IG_USERNAME;
  const password = process.env.INSTAGRAM_PASS;

  if (!username || !password) {
    throw new Error('Credenciales IG faltantes');
  }

  let proxyUrl;
  try {
    proxyUrl = await getProxy();
  } catch (err) {
    console.error('❌ Error con proxies:', err.message);
    proxyUrl = null;
  }

  // Rutas alternativas para Chromium - ACTUALIZADO
  const chromiumPaths = [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/chrome',
    '/usr/bin/google-chrome-stable',  // Nueva ruta añadida
    '/usr/bin/chrome-browser'         // Nueva ruta añadida
  ];
  
  let validChromiumPath = process.env.PUPPETEER_EXECUTABLE_PATH;
  
  if (!validChromiumPath) {
    // Verificar rutas alternativas
    for (const path of chromiumPaths) {
      try {
        await fs.access(path);
        validChromiumPath = path;
        console.log(`✅ Encontrado Chromium en: ${path}`);
        break;
      } catch (err) {
        console.log(`❌ No encontrado en: ${path}`);
      }
    }
  }

  if (!validChromiumPath) {
    // Último intento: buscar en todo el sistema
    try {
      const { stdout } = await exec('which chromium || which chromium-browser || which google-chrome || which chrome');
      validChromiumPath = stdout.trim();
      console.log(`🔍 Encontrado via which: ${validChromiumPath}`);
    } catch (error) {
      throw new Error('No se encontró ejecutable de Chromium');
    }
  }

  const launchOptions = {
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      ...(proxyUrl ? [`--proxy-server=${proxyUrl}`] : [])
    ],
    executablePath: validChromiumPath,
    ignoreHTTPSErrors: true
  };

  console.log(`🚀 Iniciando Chromium en: ${validChromiumPath}`);
  console.log('🔧 Opciones de lanzamiento:', launchOptions);
  
  const browser = await puppeteer.launch(launchOptions);
  const page = await browser.newPage();

  // ... resto del código sin cambios ...
}
