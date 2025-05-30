const express = require('express');
const puppeteer = require('puppeteer');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 10000;

// Función para verificar y encontrar Chromium
async function verifyChromium() {
  const possiblePaths = [
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chrome',
    process.env.CHROMIUM_PATH,
    process.env.PUPPETEER_EXECUTABLE_PATH
  ].filter(Boolean);

  console.log('Buscando Chromium en las rutas:');
  
  for (const chromiumPath of possiblePaths) {
    console.log(`- ${chromiumPath}`);
    try {
      if (fs.existsSync(chromiumPath)) {
        console.log(`✅ Chromium encontrado en: ${chromiumPath}`);
        return chromiumPath;
      }
    } catch (err) {
      console.log(`⚠️ Error verificando ${chromiumPath}: ${err.message}`);
    }
  }

  console.error('❌ Chromium no encontrado en ninguna ruta conocida');
  console.log('Contenido de /usr/bin:');
  const usrBinFiles = fs.readdirSync('/usr/bin');
  console.log(usrBinFiles.filter(file => file.includes('chrom')));
  
  throw new Error('Chromium no encontrado en el sistema');
}

// Configuración de Puppeteer para Render (se inicializará después de verificar)
let launchOptions;

// Middleware para analizar JSON
app.use(express.json());

// Ruta principal
app.get('/', (req, res) => {
  res.send(`
    <h1>KraveAI Backend</h1>
    <p>Operativo ✅</p>
    <p>Usa <code>/api/scrape?username=ejemplo</code> para obtener datos de Instagram</p>
    <p>Versión: 2.1.0</p>
  `);
});

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'kraveai-backend',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '2.1.0'
  });
});

// Ruta de scraping de Instagram
app.get('/api/scrape', async (req, res) => {
  if (!launchOptions) {
    return res.status(503).json({
      error: 'Servicio no listo',
      message: 'Puppeteer aún no se ha inicializado. Intenta de nuevo en unos segundos.'
    });
  }

  const { username } = req.query;
  
  if (!username) {
    return res.status(400).json({ 
      error: 'Se requiere nombre de usuario',
      ejemplo: 'https://kraveai-backend.onrender.com/api/scrape?username=jimenagallegotv'
    });
  }

  let browser;
  try {
    console.log(`[${new Date().toISOString()}] Iniciando scraping para: ${username}`);
    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    
    // Configurar User-Agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Navegar al perfil de Instagram
    console.log(`[${new Date().toISOString()}] Navegando a perfil...`);
    await page.goto(`https://www.instagram.com/${username}/`, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    
    // Extraer datos del perfil
    console.log(`[${new Date().toISOString()}] Extrayendo datos...`);
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

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] Error global:`, err.stack);
  res.status(500).json({
    error: 'Error interno del servidor',
    message: err.message,
    endpoint: req.originalUrl
  });
});

// Inicializar Puppeteer antes de iniciar el servidor
async function initializePuppeteer() {
  try {
    const executablePath = await verifyChromium();
    launchOptions = {
      executablePath,
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
    console.log('Configuración de Puppeteer inicializada con éxito');
  } catch (error) {
    console.error('Error al inicializar Puppeteer:', error);
    process.exit(1); // Salir si no se puede inicializar Puppeteer
  }
}

// Iniciar servidor después de inicializar Puppeteer
initializePuppeteer().then(() => {
  app.listen(PORT, () => {
    console.log(`[${new Date().toISOString()}] Servidor iniciado en puerto ${PORT}`);
    console.log(`[${new Date().toISOString()}] Entorno: ${process.env.NODE_ENV || 'development'}`);
    console.log(`[${new Date().toISOString()}] Ruta de Chromium: ${launchOptions.executablePath}`);
    console.log(`[${new Date().toISOString()}] URL: http://localhost:${PORT}`);
  });
});
