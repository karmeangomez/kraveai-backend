// ✅ server.js optimizado - versión estable con IA, Voz, Bitly y login con sesión persistente
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { scrapeInstagram, encryptPassword } = require('./instagramLogin');

puppeteer.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let browserInstance = null;
const pagePool = new Set();

// 🔁 Inicializar navegador y mantener sesión
async function initBrowser() {
  try {
    console.log('🚀 Iniciando Puppeteer con Stealth...');
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        '--enable-javascript',
        '--window-size=1366,768'
      ],
      ignoreHTTPSErrors: true,
      timeout: 30000
    });

    browserInstance = browser;
    const page = await browser.newPage();
    pagePool.add(page);

    const encryptedPassword = encryptPassword(process.env.INSTAGRAM_PASS);
    const loginSuccess = await scrapeInstagram(page, process.env.INSTAGRAM_USER, encryptedPassword);
    if (!loginSuccess) {
      console.warn('⚠️ Login fallido. Reintentando en 30s...');
      await browser.close();
      pagePool.clear();
      return setTimeout(initBrowser, 30000);
    }

    console.log('✅ Navegador inicializado con sesión activa');
    monitorSessions(browserInstance);
  } catch (err) {
    console.error('❌ Error iniciando navegador:', err.message);
    setTimeout(initBrowser, 30000);
  }
}

// 👁️ Monitor para mantener la sesión
async function monitorSessions(browser) {
  try {
    const page = Array.from(pagePool)[0];
    if (!page) return;
    await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 10000 });
    const isLoggedIn = await page.evaluate(() => !!document.querySelector('a[href*="/direct/inbox/"]'));
    if (!isLoggedIn) {
      console.warn('⚠️ Sesión expirada. Reiniciando...');
      await browser.close();
      pagePool.clear();
      await initBrowser();
    } else {
      setTimeout(() => monitorSessions(browser), 5 * 60 * 1000);
    }
  } catch (err) {
    console.error('❌ Monitor de sesión:', err.message);
    pagePool.clear();
    await initBrowser();
  }
}

// 📦 Scraping
app.get('/scrape/:username', async (req, res) => {
  const { username } = req.params;
  try {
    const page = Array.from(pagePool)[0] || (await browserInstance.newPage());
    const encryptedPassword = encryptPassword(process.env.INSTAGRAM_PASS);
    const data = await scrapeInstagram(page, username, encryptedPassword);
    if (!data) return res.status(500).json({ error: 'No se pudo obtener el perfil' });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: 'Error interno', details: err.message });
  }
});

// 🤖 IA
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
    res.json({ message: response.data.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ error: 'Error IA', details: err.message });
  }
});

// 🔊 Voz
app.get('/voz-prueba', async (req, res) => {
  try {
    const text = req.query.text || "Hola, esta es una voz generada con IA.";
    const response = await axios.post("https://api.openai.com/v1/audio/speech", {
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
  } catch (err) {
    res.status(500).send("Error generando voz");
  }
});

// 🔗 Bitly
app.get('/bitly-prueba', async (req, res) => {
  try {
    const longUrl = req.query.url || 'https://instagram.com';
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
    res.status(500).json({ error: 'Error Bitly', details: err.message });
  }
});

// 🩺 Salud
app.get('/health', (req, res) => {
  res.send('🟢 Servidor activo y saludable');
});

// 🟢 Iniciar
app.listen(PORT, () => {
  console.log(`🚀 Backend activo en puerto ${PORT}`);
  initBrowser();
});
