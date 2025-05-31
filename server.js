require('dotenv').config();
const express = require('express');
const app = express();
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium-min');

let browserInstance;

async function instagramLogin(page) {
  try {
    console.log("🔐 Iniciando sesión automática en Instagram...");
    await page.goto('https://instagram.com/accounts/login/', { 
      waitUntil: 'networkidle2',
      timeout: 20000
    });

    // Aceptar cookies
    try {
      await page.waitForSelector('button._a9--._ap36._a9_1', { timeout: 5000 });
      await page.click('button._a9--._ap36._a9_1');
      console.log("🍪 Cookies aceptadas");
    } catch {}

    // Ingresar credenciales
    await page.waitForSelector('input[name="username"]', { timeout: 10000 });
    await page.type('input[name="username"]', process.env.INSTAGRAM_USER);
    await page.type('input[name="password"]', process.env.INSTAGRAM_PASS);
    
    // Enviar formulario
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 })
    ]);

    // Saltar notificación
    try {
      await page.waitForSelector('button._a9--._ap36._a9_1', { timeout: 3000 });
      await page.click('button._a9--._ap36._a9_1');
      console.log("🔕 Notificación omitida");
    } catch {}

    return true;
  } catch (error) {
    console.error("❌ Error en login:", error.message);
    return false;
  }
}

async function initBrowser() {
  try {
    console.log("🚀 Iniciando Chromium...");

    // CONFIGURACIÓN CLAVE CON chromium-min
    browserInstance = await puppeteer.launch({
      executablePath: await chromium.executablePath(),
      args: [...chromium.args, '--disable-dev-shm-usage'],
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
      defaultViewport: chromium.defaultViewport,
    });

    // Login solo si hay credenciales
    if (process.env.INSTAGRAM_USER && process.env.INSTAGRAM_PASS) {
      const page = await browserInstance.newPage();
      const loggedIn = await instagramLogin(page);
      await page.close();
      if (!loggedIn) throw new Error("Error de autenticación");
    }

    console.log("✅ Chromium listo!");
  } catch (error) {
    console.error("❌ Error iniciando Chromium:", error);
    process.exit(1);
  }
}

app.get('/health', (req, res) => {
  res.status(browserInstance?.isConnected() ? 200 : 500)
     .send(browserInstance ? 'OK' : 'Browser not ready');
});

app.get('/scrape/:username', async (req, res) => {
  if (!browserInstance) return res.status(500).json({ error: "Browser no inicializado" });
  
  try {
    const page = await browserInstance.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36');
    
    await page.goto(`https://instagram.com/${req.params.username}`, {
      waitUntil: 'domcontentloaded',
      timeout: 20000
    });
    
    const data = await page.evaluate(() => {
      const meta = document.querySelector('meta[property="og:description"]');
      return {
        followers: meta ? meta.content : 'N/A'
      };
    });
    
    await page.close();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: `Error en scraping: ${error.message}` });
  }
});

const PORT = process.env.PORT || 3000;
initBrowser().then(() => {
  app.listen(PORT, () => console.log(`🌐 Servidor activo en puerto ${PORT}`));
});
