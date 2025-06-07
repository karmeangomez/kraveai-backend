require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const fs = require('fs');
const winston = require('winston');
const rateLimit = require('express-rate-limit');
const { instagramLogin, getCookies, notifyTelegram } = require('./instagramLogin');
const { createMultipleAccounts } = require('./instagramAccountCreator');

// Configurar logging con Winston
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Validar variables de entorno
const requiredEnvVars = ['PORT', 'IG_USERNAME', 'INSTAGRAM_PASS', 'TELEGRAM_CHAT_ID', 'TELEGRAM_BOT_TOKEN', 'OPENAI_API_KEY', 'BITLY_TOKEN'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0) {
  logger.error(`Faltan variables de entorno: ${missingEnvVars.join(', ')}`);
  throw new Error(`Faltan las siguientes variables de entorno: ${missingEnvVars.join(', ')}`);
}

const app = express();
const PORT = process.env.PORT || 3000;
let browserInstance = null;
let sessionStatus = 'INITIALIZING';

// CONFIGURACIÓN CRÍTICA PARA RATE LIMITER
app.set('trust proxy', true);

// Configurar rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Demasiadas solicitudes desde esta IP, intenta de nuevo después de 15 minutos.',
  keyGenerator: (req) => {
    return req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.ip;
  }
});
app.use(limiter);

// Configuración de Express
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, '.')));

// Middleware: monitoreo de memoria optimizado
app.use((req, res, next) => {
  if (Math.random() < 0.05) { // Solo 5% de las solicitudes
    const memory = process.memoryUsage();
    logger.info(`Memoria: ${Math.round(memory.rss / 1024 / 1024)}MB RSS`);
  }
  next();
});

// Inicialización del navegador para Instagram
async function initBrowser() {
  try {
    logger.info('🚀 Iniciando sesión Instagram...');
    const { browser } = await instagramLogin();
    browserInstance = browser;
    sessionStatus = 'ACTIVE';
    
    logger.info('✅ Sesión Instagram activa');
    setInterval(checkSessionValidity, 30 * 60 * 1000);  // Chequear cada 30 min
    
    // Monitoreo de memoria cada 5 min
    setInterval(() => {
      const memory = process.memoryUsage();
      logger.info(`📊 Memoria: ${Math.round(memory.rss / 1024 / 1024)}MB`);
    }, 5 * 60 * 1000);
    
  } catch (err) {
    logger.error('❌ Error crítico:', err);
    sessionStatus = 'ERROR';
    notifyTelegram(`❌ Fallo inicio sesión: ${err.message}`);
    
    // Reintento automático en 2 min
    setTimeout(initBrowser, 120000);
  }
}

// Verificación de sesión optimizada
async function checkSessionValidity() {
  if (!browserInstance) return;
  
  let page;
  try {
    page = await browserInstance.newPage();
    await page.goto('https://www.instagram.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 20000
    });
    
    const isLoggedIn = await page.evaluate(() => {
      return !!document.querySelector('a[href*="/accounts/activity/"]');
    });
    
    if (!isLoggedIn) throw new Error('Sesión expirada');
    
    sessionStatus = 'ACTIVE';
    logger.info('🔄 Sesión verificada');
    
  } catch (err) {
    logger.warn('⚠️ Sesión expirada:', err.message);
    sessionStatus = 'EXPIRED';
    notifyTelegram('🔄 Reintentando login...');
    
    try {
      await browserInstance.close();
    } catch {}
    
    initBrowser();  // Reinicio completo
  } finally {
    if (page) await page.close();
  }
}

// API: crear cuentas desde frontend
app.post('/create-accounts', async (req, res) => {
  try {
    const count = req.body.count || 3;
    if (!browserInstance) {
      return res.status(503).json({ error: 'Sesión no disponible' });
    }
    
    const page = await browserInstance.newPage();
    const accounts = await createMultipleAccounts(count, page);
    await page.close();
    
    logger.info(`${accounts.length} cuentas creadas`);
    notifyTelegram(`✅ ${accounts.length} cuentas creadas`);
    res.json({ success: true, accounts });
    
  } catch (err) {
    logger.error('Error creando cuentas:', err);
    notifyTelegram(`❌ Error creando cuentas: ${err.message}`);
    res.status(500).json({ error: 'Error creando cuentas', details: err.message });
  }
});

// API: scraping de Instagram
app.get('/api/scrape', async (req, res) => {
  const username = req.query.username;
  if (!username) {
    return res.status(400).json({ error: 'Falta ?username=' });
  }
  
  if (sessionStatus !== 'ACTIVE') {
    return res.status(503).json({ error: 'Sesión no disponible', status: sessionStatus });
  }

  let page;
  try {
    const cookies = getCookies();
    page = await browserInstance.newPage();
    
    // Configuración anti-detección
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36');
    await page.setCookie(...cookies);
    
    await page.goto(`https://www.instagram.com/${username}/`, { 
      waitUntil: 'domcontentloaded', 
      timeout: 30000 
    });
    
    // Selectores mejorados para Instagram 2025
    const profile = await page.evaluate(() => {
      const getElementText = (selector) => 
        document.querySelector(selector)?.textContent?.trim() || 'N/A';
      
      const getElementSrc = (selector) => 
        document.querySelector(selector)?.src || 'N/A';
      
      return {
        username: getElementText('header h2'),
        fullName: getElementText('header h1'),
        verified: !!document.querySelector('svg[aria-label="Verified"]'),
        followers: getElementText('header li:nth-child(2) span'),
        profilePic: getElementSrc('header img')
      };
    });
    
    await page.close();
    res.json({ profile });
    
  } catch (err) {
    logger.error('Scraping fallido:', err);
    if (page) await page.close();
    res.status(500).json({ error: 'Scraping fallido', reason: err.message });
  }
});

// API: chatbot IA (OpenAI)
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Falta el campo "message"' });
    }
    
    const resp = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: message }],
      max_tokens: 500,
      temperature: 0.7
    }, {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    res.json({ message: resp.data.choices[0].message.content });
    
  } catch (err) {
    logger.error('Error IA:', err);
    res.status(500).json({ error: 'Error IA', details: err.message });
  }
});

// API: voz con OpenAI TTS
app.get('/voz-prueba', async (req, res) => {
  try {
    const text = req.query.text || 'Hola, este es un ejemplo de voz generada.';
    const response = await axios.post('https://api.openai.com/v1/audio/speech', {
      model: 'tts-1',
      voice: 'onyx',
      input: text
    }, {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      responseType: 'arraybuffer',
      timeout: 30000
    });
    
    res.set('Content-Type', 'audio/mpeg');
    res.send(response.data);
    
  } catch (err) {
    logger.error('Error generando voz:', err);
    res.status(500).send('Error generando voz');
  }
});

// API: acortador de URLs con Bitly
app.get('/bitly-prueba', async (req, res) => {
  try {
    const longUrl = req.query.url || 'https://instagram.com';
    const response = await axios.post('https://api-ssl.bitly.com/v4/shorten', {
      long_url: longUrl
    }, {
      headers: {
        Authorization: `Bearer ${process.env.BITLY_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    res.json({ shortUrl: response.data.link });
    
  } catch (err) {
    logger.error('Error Bitly:', err);
    res.status(500).json({ error: 'Error Bitly', details: err.message });
  }
});

// Healthcheck mejorado
app.get('/health', (req, res) => {
  const healthData = {
    status: sessionStatus,
    browser: browserInstance ? 'ACTIVE' : 'INACTIVE',
    memory: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
    uptime: Math.floor(process.uptime()) + 's',
    proxies: process.env.PROXY_LIST ? process.env.PROXY_LIST.split(',').length : 0
  };
  res.json(healthData);
});

// Manejo de cierre del servidor
const server = app.listen(PORT, () => {
  logger.info(`🚀 Backend activo en puerto ${PORT}`);
  notifyTelegram(`🚀 Servidor backend activo en puerto ${PORT}`);
});

['SIGTERM', 'SIGINT'].forEach(signal => {
  process.on(signal, async () => {
    logger.info(`Recibida señal ${signal}. Cerrando servidor...`);
    
    try {
      if (browserInstance) {
        await browserInstance.close();
        logger.info('Navegador cerrado');
      }
    } catch {}
    
    server.close(() => {
      logger.info('Servidor cerrado');
      process.exit(0);
    });
  });
});

// Iniciar el sistema
initBrowser();
