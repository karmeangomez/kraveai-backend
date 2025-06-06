require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const fs = require('fs');
const puppeteer = require('puppeteer-extra');
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
    new winston.transports.Console()
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

// Configurar rate limiting para proteger las rutas
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Máximo 100 solicitudes por IP
  message: 'Demasiadas solicitudes desde esta IP, intenta de nuevo después de 15 minutos.'
});
app.use(limiter);

// Configuración de Express
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, '.')));

// Middleware: mostrar uso de memoria
app.use((req, res, next) => {
  const memory = process.memoryUsage();
  logger.info(`Memoria: ${Math.round(memory.rss / 1024 / 1024)}MB RSS`);
  next();
});

// Inicialización del navegador para Instagram
async function initBrowser() {
  try {
    logger.info('Verificando sesión de Instagram...');
    const { browser, page, cookies } = await instagramLogin();
    browserInstance = browser;
    sessionStatus = 'ACTIVE';
    logger.info('Sesión de Instagram lista.');
    setInterval(checkSessionValidity, 60 * 60 * 1000); // Verificar cada hora
  } catch (err) {
    logger.error('Error al iniciar Chromium:', err);
    sessionStatus = 'ERROR';
    notifyTelegram(`❌ Error al iniciar sesión de Instagram: ${err.message}`);
  }
}

// Verificación periódica de la sesión de Instagram
async function checkSessionValidity() {
  let page;
  try {
    const cookies = getCookies();
    if (!cookies || cookies.length === 0) throw new Error('No hay cookies disponibles');
    page = await browserInstance.newPage();
    await page.setCookie(...cookies);
    await page.goto露

    // ... (continúa con el resto del código, pero se cortó aquí)

---

### Nota sobre el código incompleto
Lamentablemente, el código de `server.js` que te estaba proporcionando se cortó nuevamente. Te pido disculpas por esto. A continuación, te proporciono el `server.js` completo y optimizado, asegurándome de que no falte ninguna parte.

#### `server.js` completo y optimizado
```javascript
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const fs = require('fs');
const puppeteer = require('puppeteer-extra');
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
    new winston.transports.Console()
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

// Configurar rate limiting para proteger las rutas
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Máximo 100 solicitudes por IP
  message: 'Demasiadas solicitudes desde esta IP, intenta de nuevo después de 15 minutos.'
});
app.use(limiter);

// Configuración de Express
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, '.')));

// Middleware: mostrar uso de memoria
app.use((req, res, next) => {
  const memory = process.memoryUsage();
  logger.info(`Memoria: ${Math.round(memory.rss / 1024 / 1024)}MB RSS`);
  next();
});

// Inicialización del navegador para Instagram
async function initBrowser() {
  try {
    logger.info('Verificando sesión de Instagram...');
    const { browser, page, cookies } = await instagramLogin();
    browserInstance = browser;
    sessionStatus = 'ACTIVE';
    logger.info('Sesión de Instagram lista.');
    setInterval(checkSessionValidity, 60 * 60 * 1000); // Verificar cada hora
  } catch (err) {
    logger.error('Error al iniciar Chromium:', err);
    sessionStatus = 'ERROR';
    notifyTelegram(`❌ Error al iniciar sesión de Instagram: ${err.message}`);
  }
}

// Verificación periódica de la sesión de Instagram
async function checkSessionValidity() {
  let page;
  try {
    const cookies = getCookies();
    if (!cookies || cookies.length === 0) throw new Error('No hay cookies disponibles');
    page = await browserInstance.newPage();
    await page.setCookie(...cookies);
    await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    const isLoggedIn = await page.evaluate(() => document.querySelector('a[href*="/accounts/activity/"]') !== null);
    await page.close();
    if (!isLoggedIn) {
      logger.warn('Sesión expirada, reintentando login...');
      const { browser, page } = await instagramLogin();
      browserInstance = browser;
      logger.info('Sesión renovada exitosamente');
    }
    sessionStatus = 'ACTIVE';
  } catch (err) {
    logger.error('Error verificando sesión:', err);
    sessionStatus = 'EXPIRED';
    notifyTelegram(`⚠️ Sesión de Instagram expirada: ${err.message}`);
  }
}

// API: crear cuentas desde frontend
app.post('/create-accounts', async (req, res) => {
  try {
    const count = req.body.count || 3;
    if (!browserInstance) {
      logger.error('Sesión de navegador no disponible');
      return res.status(500).json({ error: 'Sesión de navegador no disponible' });
    }
    const page = await browserInstance.newPage();
    const accounts = await createMultipleAccounts(count, page);
    await page.close();
    logger.info(`${accounts.length} cuentas creadas exitosamente`);
    notifyTelegram(`✅ ${accounts.length} cuentas creadas exitosamente.`);
    res.json({ success: true, accounts });
  } catch (err) {
    logger.error('Error creando cuentas:', err);
    notifyTelegram(`❌ Error al crear cuentas: ${err.message}`);
    res.status(500).json({ error: 'Error creando cuentas', details: err.message });
  }
});

// API: scraping de Instagram
app.get('/api/scrape', async (req, res) => {
  const username = req.query.username;
  if (!username) {
    logger.warn('Solicitud de scraping sin username');
    return res.status(400).json({ error: 'Falta ?username=' });
  }
  if (sessionStatus !== 'ACTIVE') {
    logger.warn('Sesión no disponible para scraping', { status: sessionStatus });
    return res.status(503).json({ error: 'Sesión no disponible', status: sessionStatus });
  }

  let page;
  try {
    const cookies = getCookies();
    page = await browserInstance.newPage();
    await page.setCookie(...cookies);
    await page.goto(`https://www.instagram.com/${username}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const profile = await page.evaluate(() => {
      const avatar = document.querySelector('header img');
      const usernameElem = document.querySelector('header section h2');
      const verified = !!document.querySelector('svg[aria-label="Verified"]');
      const fullName = document.querySelector('header section h1')?.textContent;
      const meta = document.querySelector('meta[name="description"]')?.content;
      const match = meta?.match(/([\d,.KM]+)\s+Followers/);
      return {
        username: usernameElem?.textContent || 'N/A',
        fullName: fullName || 'N/A',
        verified,
        followers: match ? match[1] : 'N/A',
        profilePic: avatar?.src || 'N/A'
      };
    });
    await page.close();
    logger.info(`Scraping exitoso para ${username}`);
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
      logger.warn('Solicitud de chat sin mensaje');
      return res.status(400).json({ error: 'Falta el campo "message"' });
    }
    const resp = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: message }],
      max_tokens: 500
    }, {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    logger.info('Respuesta de IA generada exitosamente');
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
    logger.info('Voz generada exitosamente');
    res.set('Content-Type', 'audio/mpeg');
    res.send(response.data);
  } catch (err) {
    logger.error('Error generando voz:', err);
    res.status(500).send('Error generando voz');
  }
});

// API: prueba de Bitly
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
    logger.info('URL acortada con Bitly:', { shortUrl: response.data.link });
    res.json({ shortUrl: response.data.link });
  } catch (err) {
    logger.error('Error Bitly:', err);
    res.status(500).json({ error: 'Error Bitly', details: err.message });
  }
});

// Healthcheck
app.get('/health', (req, res) => {
  const healthData = {
    status: sessionStatus,
    browser: browserInstance ? 'ACTIVE' : 'INACTIVE',
    memory: process.memoryUsage().rss,
    uptime: process.uptime()
  };
  logger.info('Healthcheck solicitado', healthData);
  res.json(healthData);
});

// Manejo de cierre del servidor
const server = app.listen(PORT, () => {
  logger.info(`Backend activo en puerto ${PORT}`);
  notifyTelegram(`🚀 Servidor backend activo en puerto ${PORT}`);
});

process.on('SIGTERM', async () => {
  logger.info('Recibida señal SIGTERM. Cerrando servidor...');
  if (browserInstance) {
    await browserInstance.close();
    logger.info('Navegador Puppeteer cerrado');
  }
  server.close(() => {
    logger.info('Servidor cerrado');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('Recibida señal SIGINT. Cerrando servidor...');
  if (browserInstance) {
    await browserInstance.close();
    logger.info('Navegador Puppeteer cerrado');
  }
  server.close(() => {
    logger.info('Servidor cerrado');
    process.exit(0);
  });
});

// Iniciar el servidor
initBrowser().catch(err => {
  logger.error('Falla crítica al iniciar el backend:', err);
  notifyTelegram(`❌ Falla crítica al iniciar el backend: ${err.message}`);
});