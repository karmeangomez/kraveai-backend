const express = require('express');
const puppeteer = require('puppeteer');
const app = express();
const PORT = process.env.PORT || 10000;

// Configuración de Puppeteer para Render
const launchOptions = {
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--single-process',
    '--disable-gpu',
    '--headless=new'
  ],
  headless: true,
  ignoreHTTPSErrors: true,
  timeout: 30000
};

// Middleware
app.use(express.json());

// Ruta principal
app.get('/', (req, res) => {
  res.send(`
    <h1>KraveAI Backend</h1>
    <p>Operativo ✅</p>
    <p>Usa <code>/api/scrape?username=ejemplo</code> para obtener datos de Instagram</p>
    <p>Versión: 2.0.0</p>
  `);
});

// Health Check Endpoint (CRÍTICO PARA RENDER)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'kraveai-backend',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '2.0.0'
  });
});

// Ruta de scraping
app.get('/api/scrape', async (req, res) => {
  const { username } = req.query;
  
  if (!username) {
    return res.status(400).json({ 
      error: 'Se requiere nombre de usuario',
      ejemplo: 'https://kraveai-backend.onrender.com/api/scrape?username=jimenagallegotv'
    });
  }

  let browser;
  try {
    console.log(`Iniciando scraping para: ${username}`);
    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    
    // Configurar navegador
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Navegar a Instagram
    console.log(`Accediendo a perfil: ${username}`);
    await page.goto(`https://www.instagram.com/${username}/`, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    
    // Extraer datos
    const profileData = await page.evaluate(() => {
      try {
        return {
          username: document.querySelector('h2')?.innerText || document.querySelector('h1')?.innerText,
          followers: document.querySelector('header section ul li:nth-child(2) span')?.innerText || 'N/A',
          profileImage: document.querySelector('header img')?.src || document.querySelector('img[data-testid="user-avatar"]')?.src,
          isVerified: !!document.querySelector('svg[aria-label="Verified"]')
        };
      } catch (e) {
        return {
          error: 'Error extrayendo datos',
          details: e.message
        };
      }
    });

    res.json(profileData);
  } catch (error) {
    console.error('Error en scraping:', error);
    res.status(500).json({ 
      error: 'Error en el servidor',
      message: error.message
    });
  } finally {
    if (browser) await browser.close();
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`✅ Servidor iniciado en puerto ${PORT}`);
  console.log(`🔍 Health check: http://localhost:${PORT}/health`);
  console.log(`🌐 Entorno: ${process.env.NODE_ENV || 'development'}`);
});
