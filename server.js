require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { ensureLoggedIn, getCookies, notifyTelegram } = require('./instagramLogin');
const { createMultipleAccounts } = require('./instagramAccountCreator');
const winston = require('winston');

const app = express();
const PORT = process.env.PORT || 3000;
let browserInstance = null;
let sessionStatus = 'INITIALIZING';

// Logger robusto
const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(info => `${info.timestamp} [${info.level.toUpperCase()}]: ${info.message}`)
  ),
  transports: [new winston.transports.Console()]
});

// Seguridad IP y limitador de velocidad
app.set('trust proxy', false);
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  message: 'Demasiadas solicitudes. Intenta más tarde.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: req => req.ip
});

app.use(limiter);
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, '.')));

// Middleware de memoria
app.use((req, res, next) => {
  const memory = process.memoryUsage().rss;
  logger.info(`🧠 Memoria: ${Math.round(memory / 1024 / 1024)}MB RSS`);
  next();
});

// Inicio y login
async function initBrowser() {
  try {
    logger.info('Verificando sesión de Instagram...');
    await ensureLoggedIn(); // <<--- CORREGIDO
    sessionStatus = 'ACTIVE';
    logger.info('✅ Sesión de Instagram lista.');
    notifyTelegram('✅ Sesión de Instagram iniciada correctamente');
  } catch (err) {
    sessionStatus = 'ERROR';
    logger.error(`❌ Error de login: ${err.message}`);
    notifyTelegram('❌ Error al iniciar sesión: ' + err.message);
  }
}

// Verifica sesión cada hora
setInterval(async () => {
  try {
    if (!browserInstance) return;
    const page = await browserInstance.newPage();
    const cookies = getCookies();
    await page.setCookie(...cookies);
    await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 15000 });

    const loggedIn = await page.evaluate(() => {
      return !!document.querySelector('a[href*="/accounts/activity/"]');
    });

    await page.close();
    if (!loggedIn) {
      logger.warn('⚠️ Sesión expirada. Reintentando login...');
      await initBrowser();
    }
  } catch (err) {
    sessionStatus = 'EXPIRED';
    logger.error(`❌ Error verificando sesión: ${err.message}`);
  }
}, 60 * 60 * 1000);

// Crear cuentas
app.post('/create-accounts', async (req, res) => {
  try {
    const count = req.body.count || 3;
    if (!browserInstance) throw new Error('Navegador no iniciado');

    const page = await browserInstance.newPage();
    const accounts = await createMultipleAccounts(count, page);
    await page.close();

    notifyTelegram(`✅ ${accounts.length} cuentas creadas exitosamente`);
    res.json({ success: true, accounts });
  } catch (err) {
    logger.error('❌ Error creando cuentas:', err.message);
    notifyTelegram('❌ Error creando cuentas: ' + err.message);
    res.status(500).json({ error: 'Error creando cuentas', details: err.message });
  }
});

// Scraping de Instagram
app.get('/api/scrape', async (req, res) => {
  try {
    const username = req.query.username;
    if (!username) return res.status(400).json({ error: "Falta ?username=" });
    if (sessionStatus !== 'ACTIVE') return res.status(503).json({ error: "Sesión no disponible", status: sessionStatus });

    const page = await browserInstance.newPage();
    const cookies = getCookies();
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
    res.status(500).json({ error: "Scraping fallido", reason: err.message });
  }
});

// Chat IA con OpenAI
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
    res.status(500).json({ error: "Error IA", details: err.message });
  }
});

// Voz con TTS
app.get('/voz-prueba', async (req, res) => {
  try {
    const text = req.query.text || "Hola, este es un ejemplo de voz generada.";
    const response = await axios.post("https://api.openai.com/v1/audio/speech", {
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
    res.status(500).send("Error generando voz");
  }
});

// Bitly
app.get('/bitly-prueba', async (req, res) => {
  try {
    const longUrl = req.query.url || "https://instagram.com";
    const response = await axios.post("https://api-ssl.bitly.com/v4/shorten", {
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
    res.status(500).json({ error: "Error Bitly", details: err.message });
  }
});

// Healthcheck
app.get('/health', (req, res) => {
  res.json({
    status: sessionStatus,
    browser: browserInstance ? 'ACTIVE' : 'INACTIVE',
    memory: process.memoryUsage().rss,
    uptime: process.uptime()
  });
});

// Arranque
app.listen(PORT, () => {
  logger.info(`🚀 Backend activo en puerto ${PORT}`);
  notifyTelegram(`🚀 Servidor backend activo en puerto ${PORT}`);
  initBrowser();
});
