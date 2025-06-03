const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');
const { scrapeInstagram, encryptPassword } = require('./instagramLogin');

puppeteer.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 3000;

let browserInstance = null;
const pagePool = new Set();

app.use(express.json());

const proxies = [
  '198.23.239.134:6540:pdsmombq:terqdq67j6mp',
  '207.244.217.165:6712:pdsmombq:terqdq67j6mp',
  '107.172.163.27:6543:pdsmombq:terqdq67j6mp',
  '161.123.152.115:6360:pdsmombq:terqdq67j6mp',
  '23.94.138.75:6349:pdsmombq:terqdq67j6mp',
  '216.10.27.159:6837:pdsmombq:terqdq67j6mp',
  '136.0.207.84:6661:pdsmombq:terqdq67j6mp',
  '64.64.118.149:6732:pdsmombq:terqdq67j6mp',
  '142.147.128.93:6593:pdsmombq:terqdq67j6mp',
  '154.36.110.199:6853:pdsmombq:terqdq67j6mp',
];
let proxyIndex = 0;

const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/118.0',
];

// 🛜 Validar y obtener próximo proxy
async function validateProxy(proxy) {
  try {
    const [host, port, username, password] = proxy.split(':');
    const response = await axios.get('https://www.google.com', {
      proxy: { host, port: parseInt(port), auth: { username, password } },
      timeout: 5000,
    });
    return response.status === 200;
  } catch {
    return false;
  }
}

async function getNextProxy() {
  for (let i = 0; i < proxies.length; i++) {
    const proxy = proxies[proxyIndex];
    proxyIndex = (proxyIndex + 1) % proxies.length;
    if (await validateProxy(proxy)) {
      console.log(`🛜 Proxy válido: ${proxy}`);
      return proxy;
    }
    console.warn(`⚠️ Proxy inválido: ${proxy}`);
  }
  console.warn('⚠️ No hay proxies válidos disponibles');
  return '';
}

// 🎲 Obtener User-Agent aleatorio
function getNextUserAgent() {
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

// 🛠️ Inicializar navegador
async function initBrowser() {
  try {
    console.log('🚀 Iniciando Puppeteer con Stealth...');
    const proxy = await getNextProxy();
    if (!proxy) throw new Error('No hay proxies válidos');

    const [host, port, username, password] = proxy.split(':');
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        '--enable-javascript',
        '--window-size=1366,768', // Reducir resolución para menos recursos
        `--proxy-server=http://${host}:${port}`,
      ],
      ignoreHTTPSErrors: true,
      timeout: 30000, // Tiempo límite para lanzamiento
    });

    const page = await browser.newPage();
    const ua = getNextUserAgent();
    await page.setUserAgent(ua);
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    });
    await page.setViewport({ width: 1366, height: 768 });

    // Evitar detección de bot
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      window.navigator.chrome = { runtime: {} };
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
    });

    // Autenticar proxy
    if (username && password) {
      await page.authenticate({ username, password });
    }

    browserInstance = browser;
    pagePool.add(page);

    // Verificar login inicial
    const encryptedPassword = encryptPassword(process.env.INSTAGRAM_PASS);
    const loginSuccess = await scrapeInstagram(page, process.env.INSTAGRAM_USER, encryptedPassword);
    if (!loginSuccess) {
      console.warn('⚠️ Login inicial fallido. Reintentando en 30 segundos...');
      await browser.close();
      pagePool.clear();
      setTimeout(initBrowser, 30000);
      return null;
    }

    console.log(`✅ Navegador inicializado con proxy: ${host}:${port}, UA: ${ua}`);
    return browser;
  } catch (err) {
    console.error('❌ Error crítico al iniciar navegador:', err.message);
    if (browserInstance) await browserInstance.close();
    pagePool.clear();
    setTimeout(initBrowser, 30000);
    return null;
  }
}

// 🔄 Monitor de sesiones
async function monitorSessions(browser) {
  while (true) {
    try {
      const page = Array.from(pagePool)[0];
      if (!page) throw new Error('No hay páginas disponibles');
      await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 15000 });
      const isLoggedIn = await page.evaluate(() => !!document.querySelector('a[href*="/direct/inbox/"]'));
      if (!isLoggedIn) {
        console.warn('⚠️ Sesión expirada. Reiniciando navegador...');
        await browser.close();
        pagePool.clear();
        await initBrowser();
      }
      await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000)); // Verificar cada 5 minutos
    } catch (err) {
      console.error('❌ Error en monitor de sesiones:', err.message);
      await browser.close();
      pagePool.clear();
      await initBrowser();
      break;
    }
  }
}

// 🌐 Endpoint para scraping de perfil
app.get('/scrape/:username', async (req, res) => {
  const { username } = req.params;
  try {
    if (!browserInstance || browserInstance.isConnected() === false) {
      console.warn('⚠️ Navegador no inicializado. Iniciando...');
      await initBrowser();
    }

    const page = Array.from(pagePool)[0] || (await browserInstance.newPage());
    const encryptedPassword = encryptPassword(process.env.INSTAGRAM_PASS);
    const data = await scrapeInstagram(page, username, encryptedPassword);

    if (!data) {
      return res.status(500).json({ error: 'Fallo al obtener datos del perfil' });
    }

    res.json({ success: true, data });
  } catch (err) {
    console.error('❌ Error en /scrape:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// 🚀 Iniciar servidor
async function startServer() {
  try {
    await initBrowser();
    app.listen(PORT, () => {
      console.log(`🌐 Servidor corriendo en puerto ${PORT}`);
      if (browserInstance) monitorSessions(browserInstance).catch(console.error);
    });
  } catch (err) {
    console.error('❌ Error al iniciar servidor:', err.message);
    setTimeout(startServer, 30000); // Reintentar en 30 segundos
  }
}

startServer();

// 🛑 Manejo de cierre
process.on('SIGTERM', async () => {
  console.log('🛑 Cerrando servidor...');
  if (browserInstance) await browserInstance.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 Cerrando servidor por SIGINT...');
  if (browserInstance) await browserInstance.close();
  process.exit(0);
});
