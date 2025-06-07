require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const winston = require('winston');
const rateLimit = require('express-rate-limit');
const { instagramLogin, getCookies, notifyTelegram } = require('./instagramLogin');
const { createMultipleAccounts } = require('./instagramAccountCreator');

// Logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    })
  ),
  transports: [new winston.transports.Console()]
});

// Validación de entorno
const requiredVars = ['IG_USERNAME', 'INSTAGRAM_PASS', 'TELEGRAM_CHAT_ID', 'TELEGRAM_BOT_TOKEN', 'OPENAI_API_KEY', 'BITLY_TOKEN'];
const missing = requiredVars.filter(k => !process.env[k]);
if (missing.length) {
  logger.error('❌ Faltan variables de entorno: ' + missing.join(', '));
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;
let browserInstance = null;
let sessionStatus = 'INITIALIZING';

app.use(express.json());
app.use(cors());

// Rate limiting
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
}));

// Middleware de logging simple
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`);
  next();
});

// Inicializa login
async function initBrowser() {
  try {
    const { browser } = await instagramLogin();
    browserInstance = browser;
    sessionStatus = 'ACTIVE';
    logger.info('✅ Login Instagram exitoso');
    notifyTelegram('✅ Sesión iniciada en Instagram');
  } catch (err) {
    logger.error('❌ Error de login: ' + err.message);
    sessionStatus = 'ERROR';
    notifyTelegram('❌ Error al iniciar sesión: ' + err.message);
  }
}

// Create accounts
app.post('/create-accounts', async (req, res) => {
  try {
    if (!browserInstance) throw new Error('No hay sesión activa');
    const count = req.body.count || 1;
    const page = await browserInstance.newPage();
    const accounts = await createMultipleAccounts(count, page);
    await page.close();
    res.json({ success: true, accounts });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Scraping
app.get('/api/scrape', async (req, res) => {
  try {
    const username = req.query.username;
    const page = await browserInstance.newPage();
    await page.setCookie(...getCookies());
    await page.goto(`https://www.instagram.com/${username}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const data = await page.evaluate(() => {
      const name = document.querySelector('header h2, header h1')?.textContent || null;
      const avatar = document.querySelector('header img')?.src || null;
      const verified = !!document.querySelector('svg[aria-label="Verified"]');
      return { name, avatar, verified };
    });

    await page.close();
    res.json({ profile: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Chat IA
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: message }]
    }, {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    res.json({ reply: response.data.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Voz
app.get('/voz-prueba', async (req, res) => {
  try {
    const text = req.query.text || 'Hola, esta es una voz generada';
    const response = await axios.post('https://api.openai.com/v1/audio/speech', {
      model: 'tts-1',
      voice: 'onyx',
      input: text
    }, {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      responseType: 'arraybuffer'
    });
    res.set('Content-Type', 'audio/mpeg');
    res.send(response.data);
  } catch (e) {
    res.status(500).send('Error generando voz');
  }
});

// Bitly
app.get('/bitly-prueba', async (req, res) => {
  try {
    const longUrl = req.query.url;
    const response = await axios.post('https://api-ssl.bitly.com/v4/shorten', {
      long_url: longUrl
    }, {
      headers: {
        Authorization: `Bearer ${process.env.BITLY_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    res.json({ shortUrl: response.data.link });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Healthcheck
app.get('/health', (req, res) => {
  res.json({
    status: sessionStatus,
    uptime: process.uptime(),
    memory: process.memoryUsage().rss
  });
});

// Start
initBrowser().then(() => {
  app.listen(PORT, () => {
    logger.info(`🚀 Backend activo en puerto ${PORT}`);
  });
});
