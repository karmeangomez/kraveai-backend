require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

// Puppeteer y plugins
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

// Módulos inteligentes
const uaDB = require('./lib/ua-database');
const geoHeaders = require('./lib/geo-headers');
const human = require('./lib/human-behavior');
const fingerprint = require('./lib/fingerprint-generator');

const app = express();
app.use(express.json());
app.use(cors());

// ✅ IA - Chat GPT-4o
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: message }]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    res.json({ message: response.data.choices[0].message.content });
  } catch (err) {
    console.error("[Chat] Error:", err.message);
    res.status(500).json({ error: "Error al procesar la solicitud de IA." });
  }
});

// ✅ Voz IA
app.get('/voz-prueba', async (req, res) => {
  try {
    const text = req.query.text || "Hola Karmean, tu voz está activa.";
    const response = await axios.post(
      'https://api.openai.com/v1/audio/speech',
      {
        model: 'tts-1',
        voice: 'onyx',
        input: text
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer'
      }
    );
    res.set('Content-Type', 'audio/mpeg');
    res.send(response.data);
  } catch (err) {
    console.error("[Voz] Error:", err.message);
    res.status(500).send("Error generando voz.");
  }
});

// ✅ Bitly
app.get('/bitly-prueba', async (req, res) => {
  try {
    const longUrl = req.query.url || "https://instagram.com";
    const response = await axios.post(
      'https://api-ssl.bitly.com/v4/shorten',
      { long_url: longUrl },
      {
        headers: {
          Authorization: `Bearer ${process.env.BITLY_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    res.json({ shortUrl: response.data.link });
  } catch (err) {
    console.error("[Bitly] Error:", err.message);
    res.status(500).json({ error: "Error al acortar URL." });
  }
});

// ✅ Scraping de Instagram con evasión avanzada
app.get('/api/scrape', async (req, res) => {
  const igUsername = req.query.username;
  if (!igUsername) return res.status(400).json({ error: 'Falta ?username=' });

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      userDataDir: './session_data',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();

    // 🧠 Aplicar rotación inteligente
    const userAgent = uaDB.getRandomUA();
    await page.setUserAgent(userAgent);

    const geo = geoHeaders.generateGeoHeaders();
    await page.setExtraHTTPHeaders(geo);

    await fingerprint.applyFingerprint(page);
    await human.randomDelay(500, 1500);

    // 🌐 Ir al perfil
    const url = `https://www.instagram.com/${igUsername}/`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 40000 });

    // 🧍 Scroll humano
    await human.humanScroll(page);
    await human.randomDelay(800, 2000);

    // 🔎 Extraer datos
    const data = await page.evaluate(() => {
      const username = document.querySelector('header h2')?.innerText || null;
      const fullName = document.querySelector('header h1')?.innerText || null;
      const verified = !!document.querySelector('header svg[aria-label="Verified"]');
      let followers = null;
      const span = document.querySelector('a[href$="/followers/"] span');
      if (span) {
        followers = span.getAttribute('title') || span.innerText;
      }
      const profilePic = document.querySelector('header img')?.src || null;
      return { username, fullName, verified, followers, profilePic };
    });

    res.json({ profile: data });
  } catch (err) {
    console.error("❌ Scraping fallido:", err.message);
    res.status(500).json({ error: "No se pudo obtener el perfil. Puede estar privado, bloqueado o Instagram limitó el acceso temporalmente." });
  } finally {
    if (browser) await browser.close();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor activo en puerto ${PORT}`);
});
