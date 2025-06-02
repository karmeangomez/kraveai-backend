// 📦 server.js - Versión completa para Railway (IA + Bitly + Voz + Instagram Scraping)

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();
app.use(express.json());
app.use(cors());

// ===== Puppeteer con login real a Instagram =====
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const chromium = require('@sparticuz/chromium');
puppeteer.use(StealthPlugin());

let browserInstance;
let isLoggedIn = false;

const humanDelay = (min = 500, max = 1500) => new Promise(res => setTimeout(res, min + Math.random() * (max - min)));

async function instagramLogin(page) {
  try {
    console.log("🔐 Iniciando sesión de Instagram");
    await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('input[name="username"]', { timeout: 15000 });
    await humanDelay();
    await page.type('input[name="username"]', process.env.IG_USER, { delay: 80 });
    await humanDelay();
    await page.type('input[name="password"]', process.env.IG_PASS, { delay: 80 });
    await humanDelay();
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 })
    ]);
    console.log("✅ Login exitoso");
    return true;
  } catch (e) {
    console.error("❌ Falló el login:", e.message);
    return false;
  }
}

async function extractProfileData(page) {
  return page.evaluate(() => {
    try {
      const username = document.querySelector('h2')?.textContent || 'N/A';
      const fullName = document.querySelector('h1')?.textContent || 'N/A';
      const verified = !!document.querySelector('svg[aria-label="Verified"]');
      let followers = 'N/A';
      const meta = document.querySelector('meta[property="og:description"]')?.content;
      if (meta && meta.includes('seguidores')) {
        const match = meta.match(/([\d,.KM]+)\sseguidores/);
        if (match) followers = match[1];
      }
      const profilePic = document.querySelector('header img')?.src || 'N/A';
      return { username, fullName, verified, followers, profilePic };
    } catch (e) {
      return { error: e.message };
    }
  });
}

app.get('/api/scrape', async (req, res) => {
  const igUsername = req.query.username;
  if (!igUsername) return res.status(400).json({ error: 'Falta el parámetro ?username=' });
  try {
    const page = await browserInstance.newPage();
    await page.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1");
    await page.goto(`https://www.instagram.com/${igUsername}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('header img', { timeout: 20000 });
    const data = await extractProfileData(page);
    await page.close();
    if (data.error) throw new Error(data.error);
    res.json({ profile: data });
  } catch (e) {
    console.error("❌ Error scraping:", e.message);
    res.status(500).json({ error: "Scraping fallido", details: e.message });
  }
});

// ===== Chat IA =====
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    const completion = await axios.post("https://api.openai.com/v1/chat/completions", {
      model: "gpt-4o",
      messages: [{ role: "user", content: message }]
    }, {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    res.json({ message: completion.data.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ error: "Error en IA", details: err.message });
  }
});

// ===== Bitly =====
app.get('/bitly-prueba', async (req, res) => {
  try {
    const longUrl = req.query.url;
    const response = await axios.post("https://api-ssl.bitly.com/v4/shorten", { long_url: longUrl }, {
      headers: {
        Authorization: `Bearer ${process.env.BITLY_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    res.json({ shortUrl: response.data.link });
  } catch (err) {
    res.status(500).json({ error: "Bitly falló", details: err.response?.data || err.message });
  }
});

// ===== Voz OpenAI =====
app.get('/voz-prueba', async (req, res) => {
  try {
    const texto = req.query.text || "Hola, tu sistema está activo.";
    const respuesta = await axios.post("https://api.openai.com/v1/audio/speech", {
      model: "tts-1",
      input: texto,
      voice: "onyx"
    }, {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      responseType: "arraybuffer"
    });
    res.set("Content-Type", "audio/mpeg");
    res.send(respuesta.data);
  } catch (err) {
    res.status(500).send("Error generando voz");
  }
});

// ===== Lanzar servidor =====
const PORT = process.env.PORT || 3000;
(async () => {
  browserInstance = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless
  });

  const loginPage = await browserInstance.newPage();
  isLoggedIn = await instagramLogin(loginPage);
  await loginPage.close();

  app.listen(PORT, () => console.log(`🚀 Servidor en puerto ${PORT}`));
})();
