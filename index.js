const express = require('express');
const puppeteer = require('puppeteer');
const app = express();
const PORT = process.env.PORT || 10000;

// Configuración mejorada de Puppeteer para Render
const launchOptions = {
  executablePath: process.env.CHROMIUM_PATH || puppeteer.executablePath(),
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

// Ruta principal de prueba
app.get('/', (req, res) => {
  res.send(`
    <h1>KraveAI Backend</h1>
    <p>Servidor funcionando correctamente</p>
    <p>Usa <code>/api/scrape?username=nombredeusuario</code> para obtener datos de Instagram</p>
    <p>Estado: <strong>Operativo</strong></p>
    <p>Versión: 1.1.0</p>
  `);
});

// Ruta para scraping de Instagram
app.get('/api/scrape', async (req, res) => {
  const { username } = req.query;
  
  if (!username) {
    return res.status(400).json({ 
      error: 'Parámetro username requerido',
      ejemplo: 'https://kraveai-backend.onrender.com/api/scrape?username=jimenagallegotv'
    });
  }

  let browser;
  try {
    console.log(`[${new Date().toISOString()}] Iniciando scraping para: ${username}`);
    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    
    // Configurar User-Agent para parecer un navegador real
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Navegar al perfil de Instagram
    console.log(`[${new Date().toISOString()}] Navegando a Instagram...`);
    await page.goto(`https://www.instagram.com/${username}/`, {
      waitUntil: 'domcontentloaded',
      timeout: 45000
    });
    
    // Tomar screenshot para diagnóstico (opcional)
    // await page.screenshot({ path: 'screenshot.png' });
    
    console.log(`[${new Date().toISOString()}] Extrayendo datos...`);
    
    // Extraer datos del perfil
    const profileData = await page.evaluate(() => {
      try {
        // Método 1: Extraer datos del JSON-LD
        const jsonLdScript = document.querySelector('script[type="application/ld+json"]');
        if (jsonLdScript) {
          const jsonData = JSON.parse(jsonLdScript.textContent);
          return {
            username: jsonData.alternateName || jsonData.name,
            followers: document.querySelector('meta[property="og:description"]')?.content?.match(/([\d,]+) Followers/)?.[1] || 'N/A',
            profileImage: jsonData.image?.contentUrl || jsonData.image,
            isVerified: !!document.querySelector('svg[aria-label="Verified"]')
          };
        }
        
        // Método 2: Extracción manual
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
        console.error('Error en page.evaluate:', e);
        return {
          error: 'Error al analizar la página',
          details: e.message
        };
      }
    });

    console.log(`[${new Date().toISOString()}] Datos obtenidos:`, profileData);
    
    // Manejar resultados vacíos
    if (!profileData.username || profileData.username === 'No encontrado') {
      return res.status(404).json({
        error: 'Perfil no encontrado',
        message: `No se encontró un perfil para @${username}`,
        solution: 'Verifica el nombre de usuario e intenta nuevamente'
      });
    }
    
    res.json(profileData);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error en scraping:`, error);
    
    // Manejar diferentes tipos de errores
    let statusCode = 500;
    let errorMessage = 'Error en el servidor';
    
    if (error.message.includes('timeout')) {
      statusCode = 504;
      errorMessage = 'Tiempo de espera agotado';
    } else if (error.message.includes('failed') || error.message.includes('ERR_CONNECTION')) {
      statusCode = 503;
      errorMessage = 'Error de conexión con Instagram';
    } else if (error.message.includes('page.goto')) {
      statusCode = 404;
      errorMessage = 'Perfil no encontrado';
    }
    
    res.status(statusCode).json({ 
      error: errorMessage,
      message: error.message,
      solution: 'Intenta nuevamente más tarde o contacta al soporte'
    });
  } finally {
    if (browser) {
      console.log(`[${new Date().toISOString()}] Cerrando navegador...`);
      await browser.close().catch(e => console.error('Error al cerrar el navegador:', e));
    }
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'kraveai-backend',
    version: '1.1.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] Error global:`, err.stack);
  res.status(500).json({
    error: 'Error interno del servidor',
    message: err.message,
    endpoint: req.originalUrl
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] Servidor iniciado en puerto ${PORT}`);
  console.log(`[${new Date().toISOString()}] Entorno: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[${new Date().toISOString()}] Ruta de Chromium: ${process.env.CHROMIUM_PATH || 'default'}`);
  console.log(`[${new Date().toISOString()}] URL: http://localhost:${PORT}`);
});
