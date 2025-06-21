// ... (imports previos) ...

async function crearCuentaInstagram(retryCount = 0) {
  // ... (código previo) ...

  try {
    // 1. Obtener proxy
    let proxy = null;
    try {
      proxy = ProxyRotationSystem.getBestProxy();
      accountData.proxy = proxy.string;
      logger.info(`🛡️ Usando proxy: ${proxy.string}`);
    } catch (error) {
      logger.warn('⚠️ Continuando sin proxy');
      accountData.proxy = 'none';
    }

    // ... (generación de datos de usuario) ...

    // 4. Configurar navegador
    const launchOptions = {
      headless: true,
      executablePath: '/usr/bin/chromium-browser',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        `--user-agent=${fingerprint.userAgent}`,
        '--single-process'
      ],
      ignoreHTTPSErrors: true
    };

    // Configurar proxy si está disponible
    if (proxy) {
      launchOptions.args.push(`--proxy-server=${proxy.ip}:${proxy.port}`);
    }

    browser = await puppeteer.launch(launchOptions);
    page = await browser.newPage();
    
    // Autenticación de proxy
    if (proxy && proxy.auth) {
      await page.authenticate({
        username: proxy.auth.username,
        password: proxy.auth.password
      });
    }

    // ... (resto del código) ...

  } catch (error) {
    // ... (manejo de errores) ...
    
    if (proxy) {
      ProxyRotationSystem.recordFailure(proxy.string);
    }
    
    // ... (lógica de reintento) ...
  } finally {
    if (browser) await browser.close();
  }
}

// ... (funciones auxiliares) ...
