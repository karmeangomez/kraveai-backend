const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const OpenAI = require("openai");
const puppeteer = require("puppeteer-core");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");

require("dotenv").config();
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const app = express();
const PORT = process.env.PORT || 3000;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 🛡️ Configuración de seguridad
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false
}));
app.use(cors());
app.use(bodyParser.json());
app.disable('x-powered-by');

// 📊 Rate limiting
const apiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 100,
  message: "Demasiadas solicitudes desde esta IP",
  standardHeaders: true,
  skip: (req) => req.ip === '127.0.0.1'
});
app.use("/api/scrape", apiLimiter);

// 🔍 Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// 🔥 Scraping de Instagram
app.get("/api/scrape", async (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json({ error: "Parámetro ?username= requerido" });

  try {
    console.log(`[SCRAPE START] @${username}`);
    const data = await scrapeInstagram(username);
    console.log(`[SCRAPE SUCCESS] @${username}`);
    res.json(data);
  } catch (error) {
    console.error(`[SCRAPE ERROR] @${username}:`, error.message);
    
    // Manejo de errores específicos
    let statusCode = 500;
    let errorMessage = "Error en el scraping";
    
    if (error.message.includes('timeout') || error.message.includes('tiempo')) {
      statusCode = 504;
      errorMessage = "Tiempo de espera agotado";
    } else if (error.message.includes('bloqueada') || error.message.includes('login')) {
      statusCode = 403;
      errorMessage = "IP bloqueada por Instagram";
    } else if (error.message.includes('no encontrado')) {
      statusCode = 404;
      errorMessage = "Usuario no encontrado";
    } else if (error.message.includes('Chromium')) {
      statusCode = 500;
      errorMessage = "Error de configuración del navegador";
    }
    
    res.status(statusCode).json({ 
      error: errorMessage,
      details: error.message
    });
  }
});

// 🚀 Función de scraping
async function scrapeInstagram(username) {
  // Verificar existencia de Chromium
  const fs = require('fs');
  const chromiumPath = process.env.CHROMIUM_PATH || '/usr/bin/chromium';
  
  if (!fs.existsSync(chromiumPath)) {
    throw new Error(`Chromium no encontrado en ${chromiumPath}`);
  }

  const browser = await puppeteer.launch({
    executablePath: chromiumPath,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--single-process",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--disable-software-rasterizer",
      `--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36`,
      "--lang=es-ES,es"
    ],
    headless: "new",
    timeout: 60000
  });

  try {
    const page = await browser.newPage();
    
    // Configuración anti-bloqueo
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'es-ES,es;q=0.9',
      'X-Requested-With': 'XMLHttpRequest'
    });
    
    // Navegación con manejo de errores
    const response = await page.goto(`https://www.instagram.com/${username}/`, {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });
    
    // Verificar respuesta HTTP
    if (response.status() === 404) {
      throw new Error(`Usuario @${username} no encontrado`);
    }
    
    // Detectar bloqueo de Instagram
    if (page.url().includes('/accounts/login/')) {
      throw new Error('Instagram ha bloqueado el acceso (requiere login)');
    }
    
    // Esperar elementos críticos
    await page.waitForSelector('meta[property="og:title"]', { timeout: 15000 });
    await page.waitForSelector('header', { timeout: 15000 });
    
    // Extracción de datos
    const data = await page.evaluate(() => {
      const getMeta = (property) => 
        document.querySelector(`meta[property="${property}"]`)?.content;
      
      const description = getMeta('og:description') || '';
      const followerMatch = description.match(/[\d,]+(?=\sseguidores)/);
      const postCount = document.querySelector('header ul li:first-child span')?.textContent;
      
      return {
        username: document.title.split('(')[0].trim().replace('• Instagram', ''),
        profileImage: getMeta('og:image'),
        followers: followerMatch ? followerMatch[0] : null,
        isVerified: !!document.querySelector('svg[aria-label="Cuenta verificada"]'),
        posts: postCount,
        bio: document.querySelector('header section > div')?.textContent?.trim(),
        lastScraped: new Date().toISOString()
      };
    });

    return data;
  } finally {
    await browser.close();
  }
}

// 🚀 Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor funcionando en puerto ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('[GLOBAL ERROR]', err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});
