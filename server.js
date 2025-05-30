// server.js
require('dotenv').config();
const express = require('express');
const app = express();
const path = require('path');
const puppeteer = require('puppeteer-core');

// 1. Configuración de Chromium
const chromiumPath = path.resolve(process.env.CHROMIUM_PATH || './chromium/chrome');
let browserInstance;  // Instancia global de Chromium

// 2. Precalentar Chromium al iniciar
async function initBrowser() {
  try {
    console.log("🚀 Starting Chromium...");
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
    console.log("✅ Chromium ready!");
  } catch (error) {
    console.error("❌ Failed to launch Chromium:", error);
    process.exit(1);
  }
}

// 3. Health check endpoint
app.get('/health', (req, res) => {
  res.status(browserInstance && browserInstance.isConnected() ? 200 : 500)
     .send(browserInstance ? 'OK' : 'Browser not ready');
});

// 4. Endpoint de scraping
app.get('/scrape/:username', async (req, res) => {
  const { username } = req.params;
  
  try {
    console.log(`🔍 Scraping Instagram: ${username}`);
    const page = await browserInstance.newPage();
    
    // Configuración anti-detection
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'es-ES,es;q=0.9'
    });
    
    // Navegación con timeout controlado
    await page.goto(`https://instagram.com/${username}`, {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });
    
    // Extracción de datos
    const data = await page.evaluate(() => {
      const metaDescription = document.querySelector('meta[property="og:description"]');
      return {
        followers: metaDescription ? metaDescription.content : 'N/A'
      };
    });
    
    await page.close();
    res.json(data);
  } catch (error) {
    console.error(`❌ Scraping failed: ${error}`);
    res.status(500).json({ error: "Scraping failed" });
  }
});

// 5. Iniciar servidor después de Chromium
const PORT = process.env.PORT || 3000;
initBrowser().then(() => {
  app.listen(PORT, () => console.log(`🌐 Server running on port ${PORT}`));
});
