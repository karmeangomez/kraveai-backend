require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { instagramLogin, ensureLoggedIn, getCookies, notifyTelegram } = require('./instagramLogin');
const { createMultipleAccounts } = require('./instagramAccountCreator');
const winston = require('winston');

const app = express();
const PORT = process.env.PORT || 3000;
let browserInstance = null;
let sessionStatus = 'INITIALIZING';

// Cola para limitar páginas concurrentes
const pageQueue = [];
let activePages = 0;
const maxConcurrentPages = parseInt(process.env.PUPPETEER_MAX_CONCURRENT_PAGES) || 2;

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(info => `${info.timestamp} [${info.level.toUpperCase()}]: ${info.message}`)
  ),
  transports: [new winston.transports.Console()]
});

app.set('trust proxy', false);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  message: 'Demasiadas solicitudes. Intenta de nuevo más tarde.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: req => req.ip
});

app.use(limiter);
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, '.')));

app.use((req, res, next) => {
  const memory = process.memoryUsage().rss;
  logger.info(`🧠 Memoria: ${Math.round(memory / 1024 / 1024)}MB RSS`);
  next();
});

// Función para adquirir una página
async function acquirePage(browser) {
  return new Promise((resolve) => {
    const tryAcquire = async () => {
      if (activePages < maxConcurrentPages) {
        activePages++;
        const page = await browser.newPage();
        resolve(page);
      } else {
        pageQueue.push(tryAcquire);
        setTimeout(tryAcquire, 100);
      }
    };
    tryAcquire();
  });
}

// Función para liberar una página
async function releasePage(page) {
  if (page && !page.isClosed()) {
    await page.close().catch(() => {});
  }
  activePages--;
  const next = pageQueue.shift();
  if (next) next();
}

async function initBrowser() {
  try {
    logger.info('Verificando sesión de Instagram...');
    await ensureLoggedIn();
    const username = process.env.IG_USERNAME;
    const password = process.env.INSTAGRAM_PASS;
    const sessionPath = path.join(__dirname, 'sessions', 'kraveaibot.json');
    const { success, browser, page } = await instagramLogin(username, password, sessionPath);
    if (!success) {
      throw new Error('Fallo al iniciar sesión en Instagram');
    }
    browserInstance = browser;
    sessionStatus = 'ACTIVE';
    logger.info('✅ Sesión de Instagram lista.');
    notifyTelegram('✅ Sesión de Instagram iniciada correctamente');
    await page.close();
  } catch (err) {
    sessionStatus = 'ERROR';
    logger.error(`❌ Error de login: ${err.message}`);
    notifyTelegram(`❌ Error al iniciar sesión: ${err.message}`);
    if (browserInstance) await browserInstance.close();
  }
}

setInterval(async () => {
  try {
    if (!browserInstance) return;
    const page = await acquirePage(browserInstance);
    try {
      const cookies = getCookies();
      await page.setCookie(...cookies);
      await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 15000 });
      const loggedIn = await page.evaluate(() => !!document.querySelector('a[href*="/accounts/activity/"]'));
      if (!loggedIn) {
        logger.warn('⚠️ Sesión expirada. Reintentando login...');
        await initBrowser();
      }
    } finally {
      await releasePage(page);
    }
  } catch (err) {
    sessionStatus = 'EXPIRED';
    logger.error(`❌ Error verificando sesión: ${err.message}`);
  }
}, 60 * 60 * 1000);

app.post('/create-accounts', async (req, res) => {
  try {
    const count = req.body.count || 3;
    if (!browserInstance) throw new Error('Navegador no iniciado');
    const page = await acquirePage(browserInstance);
    try {
      const accounts = await createMultipleAccounts(count, page);
      notifyTelegram(`✅ ${accounts.length} cuentas creadas exitosamente`);
      res.json({ success: true, accounts });
    } finally {
      await releasePage(page);
    }
  } catch (err) {
    logger.error('❌ Error creando cuentas:', err.message);
    notifyTelegram(`❌ Error creando cuentas: ${err.message}`);
    res.status(500).json({ error: 'Error creando cuentas', details: err.message });
  }
});

app.get('/api/scrape', async (req, res) => {
  try {
    const username = req.query.username;
    if (!username) return res.status(400).json({ error: "Falta ?username=" });
    if (sessionStatus !== 'ACTIVE') return res.status(503).json({ error: "Sesión no disponible", status: sessionStatus });

    const page = await acquirePage(browserInstance);
    try {
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

      res.json({ profile });
    } finally {
      await releasePage(page);
    }
  } catch (err) {
    logger.error('❌ Scraping fallido:', err.message);
    res.status(500).json({ error: "Scraping fallido", reason: err.message });
  }
});

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

app.get('/health', (req, res) => {
  res.json({
    status: sessionStatus,
    browser: browserInstance ? 'ACTIVE' : 'INACTIVE',
    memory: process.memoryUsage().rss,
    uptime: process.uptime()
  });
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM recibido. Cerrando navegador...');
  if (browserInstance) await browserInstance.close();
  process.exit(0);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', reason);
});

app.listen(PORT, () => {
  logger.info(`🚀 Backend activo en puerto ${PORT}`);
  notifyTelegram(`🚀 Servidor backend activo en puerto ${PORT}`);
  initBrowser();
});
