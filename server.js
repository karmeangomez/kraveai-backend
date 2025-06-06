// ✅ server.js funcional, estable y listo para producción sin proxies
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const { createMultipleAccounts } = require('./instagramAccountCreator');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { ensureLoggedIn, getCookies, notifyTelegram } = require('./instagramLogin');

puppeteer.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 3000;
let browserInstance = null;
let sessionStatus = 'INITIALIZING';

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, '.')));

// Middleware para mostrar uso de memoria
app.use((req, res, next) => {
  const memory = process.memoryUsage();
  console.log(`🧠 Memoria: ${Math.round(memory.rss / 1024 / 1024)}MB RSS`);
  next();
});

async function initBrowser() {
  try {
    console.log("🚀 Verificando sesión de Instagram...");
    await ensureLoggedIn();
    console.log("✅ Sesión de Instagram lista.");

    browserInstance = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        '--single-process',
        '--no-zygote',
        '--disable-accelerated-2d-canvas',
        '--js-flags=--max-old-space-size=256'
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome',
      ignoreHTTPSErrors: true
    });

    sessionStatus = 'ACTIVE';
    setInterval(checkSessionValidity, 60 * 60 * 1000);
  } catch (err) {
    console.error("❌ Error al iniciar Chromium:", err);
    sessionStatus = 'ERROR';
    notifyTelegram(`❌ Error al iniciar sesión de Instagram: ${err.message}`);
  }
}

async function checkSessionValidity() {
  try {
    const cookies = getCookies();
    if (!cookies || cookies.length === 0) throw new Error('No hay cookies disponibles');

    const page = await browserInstance.newPage();
    await page.setCookie(...cookies);
    await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 15000 });

    const isLoggedIn = await page.evaluate(() => {
      return document.querySelector('a[href*="/accounts/activity/"]') !== null;
    });

    await page.close();
    if (!isLoggedIn) {
      console.warn("⚠️ Sesión expirada, reintentando login...");
      await ensureLoggedIn();
      console.log("✅ Sesión renovada exitosamente");
    }
    sessionStatus = 'ACTIVE';
  } catch (err) {
    console.error("❌ Error verificando sesión:", err);
    sessionStatus = 'EXPIRED';
    notifyTelegram(`⚠️ Sesión de Instagram expirada: ${err.message}`);
  }
}

app.post('/create-accounts', async (req, res) => {
  try {
    const count = req.body.count || 3;
    if (!browserInstance) return res.status(500).json({ error: "Navegador no iniciado" });

    const page = await browserInstance.newPage();
    const accounts = await createMultipleAccounts(count, page);
    await page.close();

    res.json({ success: true, accounts });
    notifyTelegram(`✅ ${accounts.length} cuentas creadas exitosamente.`);
  } catch (err) {
    console.error("❌ Error creando cuentas:", err);
    notifyTelegram(`❌ Error al crear cuentas: ${err.message}`);
    res.status(500).json({ error: 'Error creando cuentas', details: err.message });
  }
});

app.get('/api/scrape', async (req, res) => {
  const username = req.query.username;
  if (!username) return res.status(400).json({ error: "Falta ?username=" });
  if (sessionStatus !== 'ACTIVE') return res.status(503).json({ error: "Sesión no disponible", status: sessionStatus });

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
    console.error("❌ Scraping fallido:", err.message);
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

initBrowser().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Backend activo en puerto ${PORT}`);
    notifyTelegram(`🚀 Servidor backend activo en puerto ${PORT}`);
  });
}).catch(err => {
  console.error('❌ Falla crítica - Servidor no iniciado:', err.message);
  notifyTelegram(`❌ Falla crítica al iniciar el backend: ${err.message}`);
  app.listen(PORT, () => {
    console.log(`⚠️ Backend iniciado SIN sesión Instagram en puerto ${PORT}`);
    notifyTelegram(`⚠️ Backend iniciado sin sesión Instagram en puerto ${PORT}`);
  });
});
