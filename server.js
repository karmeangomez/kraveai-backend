require('dotenv').config();
const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cors = require('cors');
const axios = require('axios');
const { scrapeInstagram, encryptPassword } = require('./instagramLogin');

puppeteer.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let browserInstance = null;
const pagePool = new Set();

// 🧠 INICIAR CHROMIUM
async function initBrowser() {
  try {
    console.log('🚀 Iniciando Puppeteer...');
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1366,768',
      ],
      ignoreHTTPSErrors: true,
      timeout: 30000,
    });

    browserInstance = browser;
    const page = await browser.newPage();
    pagePool.add(page);

    const encryptedPassword = encryptPassword(process.env.INSTAGRAM_PASS);
    const loginSuccess = await scrapeInstagram(page, process.env.INSTAGRAM_USER, encryptedPassword);

    if (!loginSuccess) {
      console.warn('⚠️ Login inicial fallido. Reintentando...');
      await browser.close();
      pagePool.clear();
      setTimeout(initBrowser, 30000);
      return;
    }

    console.log('✅ Chromium listo y sesión activa');
  } catch (err) {
    console.error('❌ Error al iniciar Puppeteer:', err.message);
    browserInstance?.close();
    browserInstance = null;
    pagePool.clear();
    setTimeout(initBrowser, 30000);
  }
}

// 🔄 MONITOREAR SESIÓN
async function monitorSession() {
  while (true) {
    try {
      const page = Array.from(pagePool)[0];
      if (!page) throw new Error('No hay páginas disponibles');

      await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 15000 });
      const isLoggedIn = await page.evaluate(() => !!document.querySelector('a[href*="/direct/inbox/"]'));

      if (!isLoggedIn) {
        console.warn('⚠️ Sesión expirada. Reiniciando...');
        await browserInstance.close();
        pagePool.clear();
        await initBrowser();
      }

      await new Promise(res => setTimeout(res, 5 * 60 * 1000));
    } catch (err) {
      console.error('💥 Error monitor sesión:', err.message);
      await browserInstance?.close();
      pagePool.clear();
      await initBrowser();
    }
  }
}

// 🌐 ENDPOINT SCRAPE
app.get('/scrape/:username', async (req, res) => {
  const { username } = req.params;
  try {
    if (!browserInstance || !browserInstance.isConnected()) {
      console.log('🔄 Reiniciando navegador...');
      await initBrowser();
    }

    const page = Array.from(pagePool)[0] || await browserInstance.newPage();
    const encryptedPassword = encryptPassword(process.env.INSTAGRAM_PASS);
    const data = await scrapeInstagram(page, username, encryptedPassword);

    if (!data) return res.status(500).json({ success: false, error: 'Scraping fallido' });
    res.json({ success: true, data });
  } catch (err) {
    console.error('❌ Error en /scrape:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 🤖 ENDPOINT IA (ChatGPT)
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;

  try {
    const completion = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: message }],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    res.json({ response: completion.data.choices[0].message.content });
  } catch (err) {
    console.error('❌ Error IA:', err.message);
    res.status(500).json({ error: 'Fallo al consultar la IA' });
  }
});

// 🔊 ENDPOINT VOZ (OpenAI TTS)
app.get('/voz-prueba', async (req, res) => {
  try {
    const text = req.query.text || 'Hola, esta es una prueba de voz generada con IA.';
    const response = await axios.post(
      'https://api.openai.com/v1/audio/speech',
      {
        model: 'tts-1',
        voice: 'onyx',
        input: text,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        responseType: 'arraybuffer',
      }
    );

    res.set('Content-Type', 'audio/mpeg');
    res.send(response.data);
  } catch (err) {
    console.error('❌ Error generando voz:', err.message);
    res.status(500).send('Error generando voz');
  }
});

// 🔗 ENDPOINT BITLY
app.get('/bitly-prueba', async (req, res) => {
  const longUrl = req.query.url || 'https://instagram.com';

  try {
    const result = await axios.post(
      'https://api-ssl.bitly.com/v4/shorten',
      { long_url: longUrl },
      {
        headers: {
          Authorization: `Bearer ${process.env.BITLY_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    res.json({ shortUrl: result.data.link });
  } catch (err) {
    console.error('❌ Error Bitly:', err.message);
    res.status(500).json({ error: 'Error acortando URL' });
  }
});

// ✅ ENDPOINT DE SALUD
app.get('/health', (req, res) => {
  res.send('🟢 Servidor activo y saludable');
});

// 🚀 INICIO
async function startServer() {
  await initBrowser();
  app.listen(PORT, () => {
    console.log(`🌐 Servidor activo en puerto ${PORT}`);
    monitorSession().catch(console.error);
  });
}

startServer();

// 🛑 CIERRE ORDENADO
process.on('SIGTERM', async () => {
  console.log('🛑 Cerrando servidor (SIGTERM)...');
  await browserInstance?.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 Cerrando servidor (SIGINT)...');
  await browserInstance?.close();
  process.exit(0);
});
