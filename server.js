require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const winston = require('winston');
const rateLimit = require('express-rate-limit');
const { instagramLogin, getCookies, notifyTelegram } = require('./instagramLogin');
const { createMultipleAccounts } = require('./instagramAccountCreator');

const app = express();
const PORT = process.env.PORT || 3000;
let browserInstance = null;
let sessionStatus = 'INITIALIZING';

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => `[${timestamp}] ${level.toUpperCase()}: ${message}`)
  ),
  transports: [new winston.transports.Console()]
});

// Middleware
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
}));

// Init Instagram Login
async function initBrowser() {
  try {
    logger.info('Verificando sesión de Instagram...');
    const result = await instagramLogin();
    browserInstance = result.browser;
    sessionStatus = 'ACTIVE';
    logger.info('Sesión de Instagram lista');
    notifyTelegram('✅ Sesión de Instagram iniciada');
  } catch (err) {
    sessionStatus = 'ERROR';
    logger.error('❌ Error de login: ' + err.message);
    notifyTelegram('❌ Error al iniciar sesión: ' + err.message);
  }
}

// Health
app.get('/health', (req, res) => {
  const memory = process.memoryUsage();
  res.json({
    status: sessionStatus,
    memory: `${Math.round(memory.rss / 1024 / 1024)}MB RSS`,
    uptime: `${Math.floor(process.uptime())}s`
  });
});

// Crear cuentas
app.post('/create-accounts', async (req, res) => {
  try {
    const { count = 1 } = req.body;
    if (!browserInstance) return res.status(500).json({ error: 'Navegador no iniciado' });
    const page = await browserInstance.newPage();
    const accounts = await createMultipleAccounts(count, page);
    await page.close();
    res.json({ success: true, accounts });
    notifyTelegram(`✅ ${accounts.length} cuentas creadas exitosamente.`);
  } catch (err) {
    logger.error('❌ Error creando cuentas:', err);
    res.status(500).json({ error: 'Error creando cuentas', details: err.message });
  }
});

// Scraping
app.get('/api/scrape', async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) return res.status(400).json({ error: 'Falta username' });
    const cookies = getCookies();
    const page = await browserInstance.newPage();
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
    res.json({ profile });
  } catch (err) {
    logger.error('❌ Scraping fallido:', err.message);
    res.status(500).json({ error: 'Scraping fallido', reason: err.message });
  }
});

// Chat IA
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
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
    res.json({ message: resp.data.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ error: 'Error IA', details: err.message });
  }
});

// Voz
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
    res.status(500).send('Error generando voz');
  }
});

// Bitly
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
    res.status(500).json({ error: 'Error Bitly', details: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  logger.info(`🚀 Backend activo en puerto ${PORT}`);
  initBrowser();
});
