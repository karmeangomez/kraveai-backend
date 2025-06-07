require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { instagramLogin, getCookies, notifyTelegram } = require('./instagramLogin');
const { createMultipleAccounts } = require('./instagramAccountCreator');
const winston = require('winston');

const app = express();
const PORT = process.env.PORT || 3000;
let browserInstance = null;
let sessionStatus = 'INITIALIZING';

// Logging avanzado con Winston
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ level, message, timestamp }) => {
      return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    })
  ),
  transports: [new winston.transports.Console()]
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
}));
app.use(express.static(path.join(__dirname, 'public')));

// Endpoints
app.get('/health', (req, res) => {
  res.json({
    status: sessionStatus,
    browser: browserInstance ? 'ACTIVE' : 'INACTIVE',
    uptime: process.uptime()
  });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    const result = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: message }]
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    res.json({ message: result.data.choices[0].message.content });
  } catch (err) {
    logger.error('Error en chat IA: ' + err.message);
    res.status(500).json({ error: 'Error IA', details: err.message });
  }
});

app.get('/voz-prueba', async (req, res) => {
  try {
    const text = req.query.text || "Hola, este es un ejemplo de voz generada.";
    const result = await axios.post("https://api.openai.com/v1/audio/speech", {
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
    res.send(result.data);
  } catch (err) {
    logger.error('Error de voz: ' + err.message);
    res.status(500).send("Error generando voz");
  }
});

app.get('/bitly-prueba', async (req, res) => {
  try {
    const longUrl = req.query.url || "https://instagram.com";
    const result = await axios.post("https://api-ssl.bitly.com/v4/shorten", {
      long_url: longUrl
    }, {
      headers: {
        Authorization: `Bearer ${process.env.BITLY_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    res.json({ shortUrl: result.data.link });
  } catch (err) {
    logger.error('Error Bitly: ' + err.message);
    res.status(500).json({ error: "Error Bitly", details: err.message });
  }
});

app.get('/api/scrape', async (req, res) => {
  const username = req.query.username;
  if (!username) return res.status(400).json({ error: "Falta ?username=" });

  try {
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
    logger.error('Scraping fallido: ' + err.message);
    res.status(500).json({ error: "Scraping fallido", reason: err.message });
  }
});

app.post('/create-accounts', async (req, res) => {
  try {
    const count = req.body.count || 3;
    const page = await browserInstance.newPage();
    const accounts = await createMultipleAccounts(count, page);
    await page.close();
    res.json({ success: true, accounts });
    notifyTelegram(`â ${accounts.length} cuentas creadas exitosamente.`);
  } catch (err) {
    logger.error('Error creando cuentas: ' + err.message);
    notifyTelegram(`â Error al crear cuentas: ${err.message}`);
    res.status(500).json({ error: 'Error creando cuentas', details: err.message });
  }
});

// Inicializar sesiÃ³n y lanzar backend
async function initBrowser() {
  try {
    const { browser } = await instagramLogin();
    browserInstance = browser;
    sessionStatus = 'ACTIVE';
    logger.info('â SesiÃ³n de Instagram iniciada');
    notifyTelegram(`â SesiÃ³n iniciada en ${new Date().toISOString()}`);
  } catch (err) {
    sessionStatus = 'ERROR';
    logger.error('â Fallo de login: ' + err.message);
    notifyTelegram(`â Error al iniciar sesiÃ³n: ${err.message}`);
  }
}

app.listen(PORT, () => {
  logger.info(`ð Backend corriendo en puerto ${PORT}`);
  initBrowser();
});
