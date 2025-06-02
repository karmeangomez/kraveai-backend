require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();
app.use(express.json());
app.use(cors());

// ========== LIBRERÍAS AVANZADAS ==========
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const chromium = require('@sparticuz/chromium-min');
puppeteer.use(StealthPlugin());

const { generarFingerprint } = require('./lib/fingerprint-generator');
const { obtenerHeadersGeo } = require('./lib/geo-headers');
const { randomDelay, humanScroll } = require('./lib/human-behavior');
const userAgents = require('./lib/user-agents-min.json');

let browserInstance;
let isLoggedIn = false;

// ========== LOGIN REAL ==========
async function instagramLogin(page) {
  try {
    console.log("🔐 Iniciando sesión...");
    await page.goto('https://instagram.com/accounts/login/', { waitUntil: 'networkidle2', timeout: 30000 });

    const usernameSelector = 'input[name="username"]';
    await page.waitForSelector(usernameSelector, { timeout: 15000 });

    await randomDelay();
    await page.type(usernameSelector, process.env.INSTAGRAM_USER, { delay: 80 });

    await randomDelay();
    await page.type('input[name="password"]', process.env.INSTAGRAM_PASS, { delay: 70 });

    await randomDelay();
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 })
    ]);

    console.log("✅ Sesión iniciada");
    return true;
  } catch (err) {
    console.error("❌ Error en login:", err.message);
    return false;
  }
}

// ========== NAVEGACIÓN SEGURA ==========
async function safeNavigate(page, url) {
  try {
    const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
    await page.setUserAgent(userAgent);
    await page.setExtraHTTPHeaders(obtenerHeadersGeo());
    await page.evaluateOnNewDocument(generarFingerprint);

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });

    await page.waitForSelector('img[data-testid="user-avatar"], header img', { timeout: 15000 });

    await humanScroll(page);
    await randomDelay();
    return true;
  } catch (e) {
    throw new Error("Instagram bloqueó el acceso o perfil inexistente");
  }
}

// ========== EXTRACCIÓN DE DATOS ==========
async function extractProfileData(page) {
  return page.evaluate(() => {
    try {
      const avatar = document.querySelector('img[data-testid="user-avatar"], header img');
      const usernameElem = document.querySelector('header section h2') || document.querySelector('span[title]');
      const verifiedElem = document.querySelector('svg[aria-label="Verified"]');
      let followers = 'N/A';
      const meta = document.querySelector('meta[property="og:description"]')?.content;
      if (meta?.includes('seguidores')) {
        const match = meta.match(/([\d,.KM]+)\sseguidores/);
        if (match) followers = match[1];
      }
      return {
        username: usernameElem?.textContent || 'N/A',
        fullName: document.querySelector('header h1')?.textContent || 'N/A',
        verified: !!verifiedElem,
        followers,
        profilePic: avatar?.src || 'N/A'
      };
    } catch (e) {
      return { error: "Error extrayendo datos: " + e.message };
    }
  });
}

// ========== INICIAR BROWSER CON LOGIN ==========
async function initBrowser() {
  try {
    console.log("🚀 Iniciando Chromium...");
    browserInstance = await puppeteer.launch({
      executablePath: await chromium.executablePath(),
      args: [...chromium.args, '--disable-dev-shm-usage'],
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    const page = await browserInstance.newPage();
    isLoggedIn = await instagramLogin(page);
    await page.close();

    if (!isLoggedIn) throw new Error("Login fallido");
    console.log("✅ Chromium listo y sesión activa");
  } catch (err) {
    console.error("❌ Error crítico:", err.message);
    process.exit(1);
  }
}

// ========== MÓDULOS API ==========
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
    res.status(500).json({ error: "Error IA", details: err.message });
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
      }
    });
    res.json({ shortUrl: response.data.link });
  } catch (err) {
    res.status(500).json({ error: "Error Bitly", details: err.message });
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
      responseType: 'arraybuffer'
    });
    res.set('Content-Type', 'audio/mpeg');
    res.send(response.data);
  } catch (err) {
    res.status(500).send("Error generando voz");
  }
});

// ========== API SCRAPER ==========
app.get('/api/scrape', async (req, res) => {
  const igUsername = req.query.username;
  if (!igUsername) return res.status(400).json({ error: "Falta ?username=" });
  if (!browserInstance || !isLoggedIn) return res.status(500).json({ error: "Sistema no preparado" });

  try {
    const page = await browserInstance.newPage();
    await safeNavigate(page, `https://instagram.com/${igUsername}`);
    const data = await extractProfileData(page);
    await page.close();
    res.json({ profile: data });
  } catch (e) {
    res.status(500).json({ error: "Scraping fallido", reason: e.message });
  }
});

// ========== INICIAR SERVIDOR ==========
const PORT = process.env.PORT || 3000;
initBrowser().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor activo en puerto ${PORT}`);
  });
});
