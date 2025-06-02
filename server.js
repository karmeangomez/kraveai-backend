require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const chromium = require('@sparticuz/chromium-min');

puppeteer.use(StealthPlugin());

const app = express();
app.use(express.json());
app.use(cors());

let browserInstance;
let isLoggedIn = false;

// Comportamiento humano
const humanDelay = (min = 800, max = 2500) =>
  new Promise((r) => setTimeout(r, min + Math.random() * (max - min)));

// Login a Instagram
async function instagramLogin(page) {
  try {
    console.log("🔐 Iniciando sesión...");
    await page.goto('https://instagram.com/accounts/login/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await page.waitForSelector('input[name="username"]', { timeout: 10000 });
    await page.type('input[name="username"]', process.env.IG_USER, { delay: 90 });
    await humanDelay();
    await page.type('input[name="password"]', process.env.IG_PASS, { delay: 80 });
    await humanDelay();
    await page.click('button[type="submit"]');

    await page.waitForNavigation({ timeout: 15000 }).catch(() => {});
    console.log("✅ Login exitoso");
    return true;
  } catch (err) {
    console.error("❌ Error al iniciar sesión:", err.message);
    return false;
  }
}

// Navegación segura
async function safeNavigate(page, url) {
  try {
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'es-ES,es;q=0.9'
    });
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 25000
    });
    await page.waitForSelector('header', { timeout: 15000 });
    return true;
  } catch (err) {
    throw new Error("Instagram bloqueó el acceso o el perfil no existe");
  }
}

// Extraer datos del perfil
async function extractProfileData(page) {
  return await page.evaluate(() => {
    const avatar = document.querySelector('header img');
    const usernameElem = document.querySelector('header section h2');
    const verifiedElem = document.querySelector('svg[aria-label="Verified"]');
    const metaDesc = document.querySelector('meta[property="og:description"]')?.content;
    let followers = null;

    const match = metaDesc?.match(/([\d,.]+)\sseguidores/);
    if (match) followers = match[1];

    return {
      username: usernameElem?.textContent || null,
      fullName: document.querySelector('header h1')?.textContent || null,
      verified: !!verifiedElem,
      followers,
      profilePic: avatar?.src || null
    };
  });
}

// Inicializar navegador
async function initBrowser() {
  try {
    console.log("🧠 Iniciando navegador...");
    browserInstance = await puppeteer.launch({
      executablePath: await chromium.executablePath(),
      args: chromium.args,
      headless: chromium.headless
    });

    const page = await browserInstance.newPage();
    isLoggedIn = await instagramLogin(page);
    await page.close();

    if (!isLoggedIn) throw new Error("Fallo en login");

    console.log("✅ Chromium listo y logueado");
  } catch (err) {
    console.error("💥 Falla al iniciar Chromium:", err.message);
    process.exit(1);
  }
}

// Scraper
app.get('/api/scrape', async (req, res) => {
  const username = req.query.username;
  if (!username) return res.status(400).json({ error: "Falta ?username=" });

  try {
    const page = await browserInstance.newPage();
    await page.setJavaScriptEnabled(true);
    await safeNavigate(page, `https://www.instagram.com/${username}/`);
    const profile = await extractProfileData(page);
    await page.close();

    if (!profile || !profile.username) throw new Error("Perfil inválido o privado");

    res.json({ profile });
  } catch (err) {
    res.status(500).json({ error: "No se pudo obtener el perfil", reason: err.message });
  }
});

// IA Chat
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    const result = await axios.post(
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
    res.json({ message: result.data.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ error: "Error en IA", details: err.message });
  }
});

// Bitly
app.get('/bitly-prueba', async (req, res) => {
  try {
    const url = req.query.url || "https://instagram.com";
    const result = await axios.post(
      'https://api-ssl.bitly.com/v4/shorten',
      { long_url: url },
      {
        headers: {
          Authorization: `Bearer ${process.env.BITLY_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    res.json({ shortUrl: result.data.link });
  } catch (err) {
    res.status(500).json({ error: "Bitly falló", details: err.message });
  }
});

// Voz IA
app.get('/voz-prueba', async (req, res) => {
  const texto = req.query.text || "Hola, esta es tu voz IA activa";
  try {
    const audio = await axios.post(
      'https://api.openai.com/v1/audio/speech',
      {
        model: 'tts-1',
        voice: 'onyx',
        input: texto
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
    res.send(audio.data);
  } catch (err) {
    res.status(500).send("Error generando voz");
  }
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
initBrowser().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Backend activo en puerto ${PORT}`);
    console.log("📡 Endpoint: /api/scrape?username=...");
  });
});
