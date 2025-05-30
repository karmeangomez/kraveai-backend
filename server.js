// server.js (VERSIÓN COMPLETA)
require('dotenv').config();
const express = require('express');
const app = express();
const path = require('path');
const puppeteer = require('puppeteer-core');

// Configuración de Chromium
const chromiumPath = path.resolve(process.env.CHROMIUM_PATH || './chromium/chrome');
let browserInstance;

// Función de login en Instagram
async function instagramLogin(page) {
  try {
    console.log("🔐 Intentando login automático...");
    await page.goto('https://instagram.com/accounts/login/', { 
      waitUntil: 'networkidle2',
      timeout: 15000
    });

    // Aceptar cookies si aparece
    try {
      await page.waitForSelector('button[class="_a9-- _ap36 _a9_1"]', { timeout: 5000 });
      await page.click('button[class="_a9-- _ap36 _a9_1"]');
      console.log("🍪 Cookies aceptadas");
    } catch {}

    // Rellenar credenciales
    await page.waitForSelector('input[name="username"]');
    await page.type('input[name="username"]', process.env.INSTAGRAM_USER);
    await page.type('input[name="password"]', process.env.INSTAGRAM_PASS);
    
    // Iniciar sesión
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 })
    ]);

    // Saltar notificaciones
    try {
      await page.waitForSelector('button[class="_a9-- _ap36 _a9_1"]', { timeout: 3000 });
      await page.click('button[class="_a9-- _ap36 _a9_1"]');
      console.log("🔕 Notificaciones omitidas");
    } catch {}

    return true;
  } catch (error) {
    console.error("❌ Error en login:", error.message);
    return false;
  }
}

// Precalentar Chromium
async function initBrowser() {
  try {
    console.log("🚀 Iniciando Chromium...");
    browserInstance = await puppeteer.launch({
      executablePath: chromiumPath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--single-process',
        '--no-zygote',
        '--disable-gpu'
      ],
      headless: "new",
      timeout: 30000
    });

    // Login solo si hay credenciales
    if (process.env.INSTAGRAM_USER && process.env.INSTAGRAM_PASS) {
      const page = await browserInstance.newPage();
      const loggedIn = await instagramLogin(page);
      await page.close();
      if (!loggedIn) throw new Error("Falló autenticación");
    }

    console.log("✅ Chromium listo!");
    return true;
  } catch (error) {
    console.error("❌ Error iniciando Chromium:", error);
    process.exit(1);
  }
}

// Health check
app.get('/health', (req, res) => {
  res.status(browserInstance?.isConnected() ? 200 : 500)
     .send(browserInstance ? 'OK' : 'Browser not ready');
});

// Endpoint de scraping
app.get('/scrape/:username', async (req, res) => {
  if (!browserInstance) return res.status(500).json({ error: "Browser no inicializado" });
  
  try {
    const page = await browserInstance.newPage();
    await page.goto(`https://instagram.com/${req.params.username}`, {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });
    
    // Extraer seguidores
    const followers = await page.evaluate(() => {
      const meta = document.querySelector('meta[property="og:description"]');
      return meta ? meta.content : 'N/A';
    });
    
    await page.close();
    res.json({ followers });
  } catch (error) {
    res.status(500).json({ error: `Scraping fallido: ${error.message}` });
  }
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
initBrowser().then(() => {
  app.listen(PORT, () => console.log(`🌐 Servidor en puerto ${PORT}`));
});
