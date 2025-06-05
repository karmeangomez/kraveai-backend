// ✅ server.js actualizado con logs inteligentes y sesión de Instagram persistente
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

let browserInstance = null;
let isLoggedIn = false;

// 🔁 Iniciar navegador y login
async function initBrowser() {
  try {
    console.log('🟢 Iniciando servidor...');
    console.log('🚀 Lanzando Chromium con Stealth...');

    browserInstance = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome',
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      ignoreHTTPSErrors: true
    });

    const page = await browserInstance.newPage();
    console.log(`📱 User-Agent usado: ${await page.evaluate(() => navigator.userAgent)}`);

    const loginStatus = await instagramLogin(
      page,
      process.env.INSTAGRAM_USER,
      process.env.INSTAGRAM_PASS,
      'default'
    );
    await page.close();

    if (!loginStatus) {
      console.error('❌ Login fallido. Verifica tus credenciales o posibles bloqueos de Instagram');
      isLoggedIn = false;
      return;
    }

    isLoggedIn = true;
    console.log('✅ Chromium listo y sesión de Instagram activa con cookies guardadas');
  } catch (err) {
    console.error('❌ Error crítico al iniciar el sistema:', err.message);
    process.exit(1);
  }
}

// 🌐 Scraping de perfil
app.get('/api/scrape', async (req, res) => {
  const igUsername = req.query.username;
  const targeting = (req.query.targeting || 'GLOBAL').toUpperCase();

  if (!igUsername) return res.status(400).json({ error: 'Falta ?username=' });
  if (!browserInstance || !isLoggedIn) return res.status(500).json({ error: 'Sistema no preparado' });

  try {
    const page = await browserInstance.newPage();
    await page.goto(`https://instagram.com/${igUsername}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('meta[property="og:description"]', { timeout: 10000 });
    const data = await page.evaluate(() => {
      const meta = document.querySelector('meta[property="og:description"]')?.content || '';
      const followers = meta.match(/([\d.,KM]+) seguidores/);
      return {
        username: location.pathname.replaceAll('/', ''),
        followers: followers ? followers[1] : 'N/A',
        url: location.href,
        createdAt: new Date().toISOString()
      };
    });
    await page.close();

    data.targeting = targeting;
    data.countryFlags = targeting === 'LATAM'
      ? ['🇲🇽', '🇦🇷', '🇨🇴', '🇨🇱', '🇵🇪', '🇻🇪']
      : ['🌍'];

    res.json({ profile: data });
  } catch (err) {
    res.status(500).json({ error: 'Scraping fallido', reason: err.message });
  }
});

// 🧠 IA
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    const resp = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: message }]
    }, {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    res.json({ message: resp.data.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ error: 'Error IA', details: err.message });
  }
});

// 🔊 Voz
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
      responseType: 'arraybuffer'
    });
    res.set('Content-Type', 'audio/mpeg');
    res.send(response.data);
  } catch (err) {
    res.status(500).send('Error generando voz');
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

// 🔍 Health check
app.get('/health', (req, res) => {
  res.send('🟢 Server running and healthy!');
});

// 🚀 Iniciar servidor
initBrowser().then(() => {
  app.listen(PORT, () => {
    console.log(`🌐 Backend activo en puerto ${PORT}`);
  });
});
