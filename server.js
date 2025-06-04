// ✅ server.js optimizado - versión estable con IA, Voz, Bitly y login con sesión persistente
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { instagramLogin } = require('./instagramLogin');

puppeteer.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 🕒 Configuración global
let browserInstance = null;
let pageInstance = null;

async function initializeBrowser() {
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
        '--window-size=1366,768',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--lang=en-US,en;q=0.9',
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome',
      ignoreHTTPSErrors: true,
      timeout: 30000
    });

    browserInstance = browser;
    pageInstance = await browser.newPage();
    await pageInstance.setJavaScriptEnabled(true);

    // Inyectar propiedades para evitar detección
    await pageInstance.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      window.navigator.chrome = { runtime: {} };
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    });

    console.log(`Intentando login con usuario: ${process.env.INSTAGRAM_USER || 'no definido'}`);
    const loginSuccess = await instagramLogin(pageInstance, process.env.INSTAGRAM_USER || '', process.env.INSTAGRAM_PASS || '');
    if (!loginSuccess) {
      throw new Error('Login fallido');
    }

    console.log('✅ Navegador inicializado con sesión activa');
    return { browser, page: pageInstance };
  } catch (err) {
    console.error('❌ Error iniciando navegador:', err.message);
    if (browserInstance) {
      await browserInstance.close();
    }
    browserInstance = null;
    pageInstance = null;
    throw err;
  }
}

// 👁️ Monitor de sesión
async function monitorSession() {
  if (!browserInstance || !pageInstance) return;
  try {
    await pageInstance.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    const isLoggedIn = await pageInstance.evaluate(() => !!document.querySelector('svg[aria-label="Inicio"]'));
    if (!isLoggedIn) {
      console.warn('⚠️ Sesión expirada. Reiniciando...');
      await browserInstance.close();
      browserInstance = null;
      pageInstance = null;
      await initializeBrowser();
    } else {
      setTimeout(monitorSession, 15 * 60 * 1000);
    }
  } catch (err) {
    console.error('❌ Error en monitor de sesión:', err.message);
    await browserInstance.close();
    browserInstance = null;
    pageInstance = null;
    await initializeBrowser();
  }
}

// 📦 Scraping (Ejemplo básico, ajustar según necesidades)
app.get('/scrape/:username', async (req, res) => {
  if (!browserInstance || !pageInstance) {
    return res.status(503).json({ error: 'Servicio temporalmente no disponible' });
  }
  const { username } = req.params;
  try {
    await pageInstance.goto(`https://www.instagram.com/${username}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });

    await pageInstance.waitForFunction(
      () => document.querySelector('img[alt*="profile picture"]') || document.querySelector('h1'),
      { timeout: 15000 }
    );

    await pageInstance.evaluate(() => window.scrollBy(0, 300 + Math.random() * 100));
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 500));

    const data = await pageInstance.evaluate(() => {
      return {
        username: document.querySelector('h1')?.textContent || '',
        profile_pic_url: document.querySelector('img[alt*="profile picture"]')?.src || '',
        followers_count: document.querySelector('header section ul li:nth-child(2) span')?.textContent || '0',
        is_verified: !!document.querySelector('header section svg[aria-label="Verified"]'),
      };
    });

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
    const longUrl = req.query.url || 'https://www.instagram.com';
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
(async () => {
  try {
    console.log('🟢 Iniciando servidor...');
    await initializeBrowser();
    monitorSession();
    app.listen(PORT, () => {
      console.log(`🚀 Backend activo en puerto ${PORT}`);
    });
  } catch (err) {
    console.error('❌ Fallo al iniciar el servidor:', err.message);
    process.exit(1);
  }
})();
