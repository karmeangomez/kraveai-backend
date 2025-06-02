require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const app = express();
app.use(express.json());
app.use(cors());

// Verificación básica
if (!process.env.IG_USER || !process.env.IG_PASS) {
  console.warn("⚠️ IG_USER o IG_PASS no configurados.");
}
if (!process.env.OPENAI_API_KEY) {
  console.warn("⚠️ Falta OPENAI_API_KEY.");
}
if (!process.env.BITLY_TOKEN) {
  console.warn("⚠️ Falta BITLY_TOKEN.");
}

// Chat IA
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
    console.error("[Chat] Error:", err.message);
    res.status(500).json({ error: "Error IA." });
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
      }
    });
    res.json({ shortUrl: response.data.link });
  } catch (err) {
    console.error("[Bitly] Error:", err.message);
    res.status(500).json({ error: "Error Bitly" });
  }
});

// Voz
app.get('/voz-prueba', async (req, res) => {
  try {
    const text = req.query.text || "Hola Karmean, tu voz está activa.";
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
    console.error("[Voz] Error:", err.message);
    res.status(500).send("Error generando voz");
  }
});

// 🔍 Scraper real de Instagram con optimización
app.get('/api/scrape', async (req, res) => {
  const igUsername = req.query.username;
  if (!igUsername) return res.status(400).json({ error: "Falta ?username=" });

  console.log(`🔍 Iniciando scraping para @${igUsername}`);
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      userDataDir: './session_data',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/113 Safari/537.36');

    const profileURL = `https://www.instagram.com/${igUsername}/`;
    await page.goto(profileURL, { waitUntil: 'networkidle2', timeout: 60000 });

    // 👁 Simula scroll para forzar carga del DOM
    await page.evaluate(() => window.scrollBy(0, 300));
    await page.waitForTimeout(1500);

    // Esperar por imagen de perfil (más confiable que <header>)
    await page.waitForSelector('img[src*="profile"]', { timeout: 20000 });

    const data = await page.evaluate(() => {
      const getMeta = (prop) => document.querySelector(`meta[property="${prop}"]`)?.content;
      const desc = getMeta("og:description") || "";
      const match = desc.match(/([\d,.]+)\sseguidores/);

      const username = document.title.split("(")[0].trim().replace("• Instagram", "") || null;
      const profileImage = getMeta("og:image");
      const followers = match ? match[1] : null;
      const isVerified = !!document.querySelector('svg[aria-label="Cuenta verificada"], svg[aria-label="Verified"]');

      const fullName = document.querySelector('header h1')?.innerText || null;

      return { username, fullName, verified: isVerified, followers, profilePic: profileImage };
    });

    console.log("✅ Perfil obtenido:", data.username);
    res.json({ profile: data });
  } catch (err) {
    console.error("❌ Scraping error:", err.message);
    res.status(500).json({ error: "No se pudo obtener el perfil. Puede estar privado, bloqueado o Instagram limitó el acceso temporalmente." });
  } finally {
    if (browser) await browser.close();
  }
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Backend activo en puerto ${PORT}`);
});
