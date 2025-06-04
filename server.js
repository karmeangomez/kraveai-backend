require('dotenv').config();
const express = require('express');
const puppeteer = require('puppeteer');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cors = require('cors');
const { scrapeInstagram, encryptPassword } = require('./instagramLogin');

puppeteer.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors()); // Habilita CORS para solicitudes externas
app.use(express.json());

let browserInstance = null;
const pagePool = new Set();

// 🛠️ Inicializar navegador
async function initBrowser() {
  try {
    console.log('🚀 Iniciando Puppeteer con Stealth...');
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        '--enable-javascript',
        '--window-size=1366,768',
      ],
      ignoreHTTPSErrors: true,
      timeout: 30000,
    });

    const page = await browser.newPage();
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

    console.log('✅ Navegador inicializado');
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
