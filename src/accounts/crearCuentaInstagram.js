// En src/accounts/crearCuentaInstagram.js
import ProxyRotationSystem from '../proxies/proxyRotationSystem.js';

async function crearCuentaInstagram() {
  // ... código anterior ...
  
  try {
    // 1. Obtener el MEJOR proxy disponible
    const proxy = ProxyRotationSystem.getBestProxy();
    if (!proxy) throw new Error('No hay proxies premium disponibles');
    
    accountData.proxy = proxy.string;
    logger.info(`🛡️ Usando proxy premium: ${proxy.ip}:${proxy.port}`);

    // 2. Configurar instancia de navegador con autenticación proxy
    const browserArgs = [
      // ... otros args ...
      `--proxy-server=${proxy.string}`
    ];

    browser = await puppeteer.launch({ args: browserArgs });
    page = await browser.newPage();
    
    // 3. Autenticación proxy si es necesario
    if (proxy.auth) {
      await page.authenticate({
        username: proxy.auth.username,
        password: proxy.auth.password
      });
    }
    
    // ... resto del código ...
  } catch (error) {
    // Registrar fallo del proxy
    if (proxy) {
      ProxyRotationSystem.recordFailure(proxy.string);
    }
    // ... manejo de errores ...
  }
}
