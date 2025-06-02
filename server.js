require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const chromium = require('@sparticuz/chromium');

puppeteer.use(StealthPlugin());

const app = express();
app.use(express.json());
app.use(cors());

// Inicializar navegador Puppeteer
async function launchBrowser() {
  return await puppeteer.launch({
    executablePath: await chromium.executablePath(),
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    headless: chromium.headless,
  });
}

// ======================= SCRAPING INSTAGRAM =======================
app.get('/api/scrape', async (req, res) => {
  const username = req.query.username;
  if (!username) return res.status(400).json({ error: 'Falta ?username=' });

  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.goto(`https://www.instagram.com/${username}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Espera inteligente
    await page.waitForSelector('header img', { timeout: 10000 });

    const data = await page.evaluate(() => {
      const avatar = document.querySelector('header img')?.src || null;
      const username = document.querySelector('header section h2, header h1')?.textContent || null;
      const verified = !!document.querySelector('svg[aria-label="Cuenta verificada"], svg[aria-label="Verified"]');
      const followersMeta = document.querySelector('meta[property="og:description"]')?.content || "";
      const match = followersMeta.match(/([\d.,KM]+)\sseguidores/);
      const followers = match ? match[1] : "N/A";

      return { username, avatar, verified, followers };
    });

    res.json({ profile: data });
  } catch (err) {
    res.status(500).json({ error: 'Error al scrapear el perfil', details: err.message });
  } finally {
    if (browser) await browser.close();
  }
});

// ======================= API IA CHAT =======================
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
    res.status(500).json({ error: "Error en OpenAI", details: err.message });
  }
});

// ======================= BITLY =======================
app.get('/bitly-prueba', async (req, res) => {
  try {
    const longUrl = req.query.url || "https://instagram.com";
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
    res.status(500).json({ error: "Error en Bitly", details: err.message });
  }
});

// ======================= OPENAI VOZ =======================
app.get('/voz-prueba', async (req, res) => {
  try {
    const texto = req.query.text || "Hola Karmean, esta es tu voz personalizada.";
    const response = await axios.post("https://api.openai.com/v1/audio/speech", {
      model: 'tts-1',
      voice: 'onyx',
      input: texto
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

// ======================= SERVIDOR =======================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Backend activo en puerto ${PORT}`);
});
