require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const winston = require('winston');
const rateLimit = require('express-rate-limit');
const { instagramLogin, getCookies, notifyTelegram } = require('./instagramLogin');
const { createMultipleAccounts } = require('./instagramAccountCreator');

// Configuración mejorada de logging
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: path.join(process.env.LOG_DIR || 'logs', 'error.log'),
      level: 'error',
      maxsize: 5 * 1024 * 1024 // 5MB
    }),
    new winston.transports.File({ 
      filename: path.join(process.env.LOG_DIR || 'logs', 'combined.log'),
      maxsize: 10 * 1024 * 1024 // 10MB
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Validar variables de entorno
const requiredEnvVars = [
  'PORT', 
  'IG_USERNAME', 
  'INSTAGRAM_PASS', 
  'TELEGRAM_CHAT_ID', 
  'TELEGRAM_BOT_TOKEN', 
  'OPENAI_API_KEY', 
  'BITLY_TOKEN'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0) {
  const errorMsg = `Faltan variables de entorno requeridas: ${missingEnvVars.join(', ')}`;
  logger.error(errorMsg);
  throw new Error(errorMsg);
}

const app = express();
const PORT = process.env.PORT || 3000;
let browserInstance = null;
let sessionStatus = 'INITIALIZING';

// Configuración avanzada de proxy y rate limiting
app.set('trust proxy', process.env.TRUST_PROXY_LEVEL || 1);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: process.env.RATE_LIMIT_MAX || 100,
  message: {
    error: 'Rate limit exceeded',
    message: 'Demasiadas solicitudes desde esta IP, intenta de nuevo después de 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.headers['x-real-ip'] || 
           req.headers['x-forwarded-for']?.split(',')[0] || 
           req.ip;
  }
});

app.use(limiter);
app.use(express.json({ limit: '10kb' }));
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.static(path.join(__dirname, 'public')));

// Middleware de monitoreo mejorado
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.http({
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      responseTime: `${duration}ms`,
      memoryUsage: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`
    });
  });
  next();
});

// Función mejorada de inicialización del navegador
async function initBrowser() {
  try {
    logger.info('Iniciando sesión en Instagram...');
    
    const maxAttempts = 3;
    let attempt = 0;
    let lastError;
    
    while (attempt < maxAttempts) {
      try {
        attempt++;
        const { browser } = await instagramLogin();
        browserInstance = browser;
        sessionStatus = 'ACTIVE';
        
        logger.info('✅ Sesión de Instagram iniciada correctamente');
        notifyTelegram('✅ Sesión de Instagram iniciada');
        
        // Programar verificación periódica
        setInterval(checkSessionValidity, 30 * 60 * 1000); // 30 minutos
        
        return;
      } catch (error) {
        lastError = error;
        logger.warn(`Intento ${attempt} fallido: ${error.message}`);
        
        if (attempt < maxAttempts) {
          const delay = Math.pow(2, attempt) * 1000; // Backoff exponencial
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
    
  } catch (error) {
    sessionStatus = 'ERROR';
    logger.error('Error crítico al iniciar sesión:', error);
    notifyTelegram(`❌ Error crítico: ${error.message}`);
    
    // Reintento automático con backoff
    setTimeout(initBrowser, 120000);
  }
}

// Verificación de sesión optimizada
async function checkSessionValidity() {
  if (!browserInstance || !browserInstance.isConnected()) {
    sessionStatus = 'DISCONNECTED';
    return initBrowser();
  }

  let page;
  try {
    page = await browserInstance.newPage();
    await page.setDefaultNavigationTimeout(20000);
    
    // Verificación en dos pasos
    await page.goto('https://www.instagram.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });
    
    const isLoggedIn = await page.evaluate(() => {
      try {
        return !!document.querySelector('a[href*="/accounts/activity/"]');
      } catch {
        return false;
      }
    });
    
    if (!isLoggedIn) {
      throw new Error('Sesión no activa detectada');
    }
    
    sessionStatus = 'ACTIVE';
    logger.debug('Verificación de sesión exitosa');
    
  } catch (error) {
    sessionStatus = 'EXPIRED';
    logger.warn('Sesión expirada o inválida:', error.message);
    notifyTelegram('🔄 Sesión expirada, reiniciando...');
    
    try {
      await browserInstance.close();
    } catch (error) {
      logger.error('Error al cerrar navegador:', error);
    }
    
    await initBrowser();
    
  } finally {
    if (page && !page.isClosed()) {
      await page.close();
    }
  }
}

// API: Creación de cuentas con manejo mejorado de errores
app.post('/create-accounts', async (req, res) => {
  try {
    const { count = 1, proxy } = req.body;
    
    if (!browserInstance || sessionStatus !== 'ACTIVE') {
      return res.status(503).json({ 
        error: 'Service Unavailable',
        message: 'El servicio de Instagram no está disponible actualmente',
        status: sessionStatus
      });
    }
    
    if (count > 5) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'No se pueden crear más de 5 cuentas a la vez'
      });
    }
    
    const page = await browserInstance.newPage();
    try {
      const accounts = await createMultipleAccounts(count, page, proxy);
      res.json({ 
        success: true,
        count: accounts.length,
        accounts 
      });
    } finally {
      if (!page.isClosed()) {
        await page.close();
      }
    }
    
  } catch (error) {
    logger.error('Error en creación de cuentas:', error);
    notifyTelegram(`❌ Error creando cuentas: ${error.message}`);
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al crear cuentas',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// API: Scraping con caché y manejo mejorado
const scrapeCache = new Map();
app.get('/api/scrape', async (req, res) => {
  try {
    const { username, force = false } = req.query;
    
    if (!username) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'El parámetro username es requerido'
      });
    }
    
    // Verificar caché
    if (!force && scrapeCache.has(username)) {
      const cached = scrapeCache.get(username);
      if (Date.now() - cached.timestamp < 5 * 60 * 1000) { // 5 minutos de caché
        return res.json(cached.data);
      }
    }
    
    if (!browserInstance || sessionStatus !== 'ACTIVE') {
      return res.status(503).json({ 
        error: 'Service Unavailable',
        message: 'El servicio de scraping no está disponible actualmente'
      });
    }
    
    const page = await browserInstance.newPage();
    try {
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36');
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9'
      });
      
      const cookies = getCookies();
      if (cookies && cookies.length) {
        await page.setCookie(...cookies);
      }
      
      await page.goto(`https://www.instagram.com/${username}/`, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      
      // Detectar posibles bloqueos
      const isBlocked = await page.evaluate(() => {
        return document.body.innerText.includes('blocked') || 
               document.title.includes('Restricted');
      });
      
      if (isBlocked) {
        throw new Error('Cuenta bloqueada o restringida');
      }
      
      const profile = await page.evaluate(() => {
        const getText = (selector) => 
          document.querySelector(selector)?.textContent?.trim() || null;
        
        const getSrc = (selector) => 
          document.querySelector(selector)?.src || null;
        
        const metaDescription = document.querySelector('meta[name="description"]')?.content;
        let followers = null;
        
        if (metaDescription) {
          const match = metaDescription.match(/([\d,]+)\s+followers/i);
          if (match) followers = match[1];
        }
        
        return {
          username: getText('header h2') || getText('header h1'),
          fullName: getText('header h1') || getText('header h2'),
          verified: !!document.querySelector('svg[aria-label="Verified"]'),
          followers,
          profilePic: getSrc('header img') || getSrc('img[alt*="profile"]'),
          bio: getText('header + section > div'),
          posts: getText('header ul li:first-child span')
        };
      });
      
      // Actualizar caché
      scrapeCache.set(username, {
        timestamp: Date.now(),
        data: { profile }
      });
      
      res.json({ profile });
      
    } finally {
      if (!page.isClosed()) {
        await page.close();
      }
    }
    
  } catch (error) {
    logger.error('Error en scraping:', error);
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al obtener datos del perfil',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// API: Chat IA con límites mejorados
app.post('/api/chat', async (req, res) => {
  try {
    const { message, model = 'gpt-4o', max_tokens = 500 } = req.body;
    
    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'El campo message es requerido y debe ser un texto'
      });
    }
    
    if (message.length > 1000) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'El mensaje no puede exceder los 1000 caracteres'
      });
    }
    
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model,
      messages: [{ role: 'user', content: message }],
      max_tokens: Math.min(max_tokens, 1000),
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    res.json({
      response: response.data.choices[0].message.content,
      usage: response.data.usage
    });
    
  } catch (error) {
    logger.error('Error en API de IA:', error);
    
    const status = error.response?.status || 500;
    const message = error.response?.data?.error?.message || 
                   'Error al procesar la solicitud de IA';
    
    res.status(status).json({
      error: 'AI Service Error',
      message,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// API: Voz con validación de entrada
app.get('/voz-prueba', async (req, res) => {
  try {
    let { text = 'Hola, este es un ejemplo de voz generada.', voice = 'onyx' } = req.query;
    
    if (text.length > 500) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'El texto no puede exceder los 500 caracteres'
      });
    }
    
    const validVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
    if (!validVoices.includes(voice)) {
      voice = 'onyx';
    }
    
    const response = await axios.post('https://api.openai.com/v1/audio/speech', {
      model: 'tts-1',
      voice,
      input: text
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      responseType: 'arraybuffer',
      timeout: 30000
    });
    
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': response.data.length
    });
    
    res.send(response.data);
    
  } catch (error) {
    logger.error('Error en generación de voz:', error);
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al generar audio',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// API: Bitly con validación de URL
app.get('/bitly-prueba', async (req, res) => {
  try {
    let { url = 'https://instagram.com' } = req.query;
    
    // Validar URL
    try {
      new URL(url);
    } catch {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'La URL proporcionada no es válida'
      });
    }
    
    const response = await axios.post('https://api-ssl.bitly.com/v4/shorten', {
      long_url: url
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.BITLY_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    res.json({
      url: response.data.link,
      id: response.data.id
    });
    
  } catch (error) {
    logger.error('Error en Bitly:', error);
    
    const status = error.response?.status || 500;
    const message = error.response?.data?.message || 
                   'Error al acortar la URL';
    
    res.status(status).json({
      error: 'URL Shortener Error',
      message,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Healthcheck mejorado
app.get('/health', (req, res) => {
  const memory = process.memoryUsage();
  
  res.json({
    status: 'OK',
    services: {
      instagram: sessionStatus,
      browser: browserInstance && browserInstance.isConnected() ? 'connected' : 'disconnected',
      memory: {
        rss: `${Math.round(memory.rss / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memory.heapTotal / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)}MB`
      },
      uptime: `${Math.floor(process.uptime())}s`,
      environment: process.env.NODE_ENV || 'development'
    }
  });
});

// Cierre controlado
function gracefulShutdown() {
  logger.info('Iniciando apagado controlado...');
  
  const shutdownPromises = [];
  
  if (browserInstance && browserInstance.isConnected()) {
    shutdownPromises.push(
      browserInstance.close()
        .then(() => logger.info('Navegador cerrado correctamente'))
        .catch(error => logger.error('Error al cerrar navegador:', error))
    );
  }
  
  Promise.all(shutdownPromises)
    .then(() => {
      server.close(() => {
        logger.info('Servidor HTTP cerrado');
        process.exit(0);
      });
    })
    .catch(error => {
      logger.error('Error durante el apagado:', error);
      process.exit(1);
    });
  
  // Forzar cierre después de 10 segundos
  setTimeout(() => {
    logger.warn('Forzando cierre por timeout...');
    process.exit(1);
  }, 10000);
}

const server = app.listen(PORT, () => {
  logger.info(`Servidor iniciado en puerto ${PORT}`);
  notifyTelegram(`🚀 Servidor backend activo en puerto ${PORT}`);
  
  // Iniciar sesión de Instagram
  initBrowser();
});

// Manejadores de señales
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
  logger.error('Excepción no capturada:', error);
  notifyTelegram(`💥 Error crítico no capturado: ${error.message}`);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Promesa rechazada no manejada:', reason);
  notifyTelegram(`⚠️ Promesa rechazada: ${reason.message || reason}`);
});
