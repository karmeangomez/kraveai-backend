const express = require('express');
const puppeteer = require('puppeteer');
const app = express();
const PORT = process.env.PORT || 10000;

// Configuración de Puppeteer
const launchOptions = {
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
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

// Middleware para analizar JSON
app.use(express.json());

// Ruta principal
app.get('/', (req, res) => {
  res.send(`
    <h1>KraveAI Backend</h1>
    <p>Operativo ✅</p>
    <p>Usa <code>/api/scrape?username=ejemplo</code> para obtener datos de Instagram</p>
    <p>Versión: 3.0.0</p>
  `);
});

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'kraveai-backend',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '3.0.0',
    chromiumPath: process.env.PUPPETEER_EXECUTABLE_PATH
  });
});

// Ruta de scraping de Instagram
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
    
    // Configurar User-Agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Navegar al perfil de Instagram
    console.log(`Navegando a perfil...`);
    await page.goto(`https://www.instagram.com/${username}/`, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    
    // Extraer datos del perfil
    console.log(`Extrayendo datos...`);
    const profileData = await page.evaluate(() => {
      try {
        // Intentar encontrar elementos clave
        const usernameElement = document.querySelector('h2') || document.querySelector('h1');
        const followersElement = document.querySelector('header section ul li:nth-child(2) span');
        const profileImageElement = document.querySelector('header img') || document.querySelector('img[data-testid="user-avatar"]');
        
        return {
          username: usernameElement?.innerText || 'No encontrado',
          followers: followersElement?.innerText || 'N/A',
          profileImage: profileImageElement?.src || 'https://via.placeholder.com/150',
          isVerified: !!document.querySelector('svg[aria-label="Verified"]')
        };
      } catch (e) {
        return {
          error: 'Error al analizar la página',
          details: e.message
        };
      }
    });

    console.log(`Datos obtenidos:`, profileData);
    
    res.json(profileData);
  } catch (error) {
    console.error(`Error en scraping:`, error);
    
    res.status(500).json({ 
      error: 'Error en el servidor',
      message: error.message,
      solution: 'Intenta nuevamente más tarde'
    });
  } finally {
    if (browser) {
      console.log(`Cerrando navegador...`);
      await browser.close().catch(e => console.error('Error al cerrar el navegador:', e));
    }
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`✅ Servidor iniciado en puerto ${PORT}`);
  console.log(`🌐 Entorno: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔍 Chromium path: ${launchOptions.executablePath}`);
});
