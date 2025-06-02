require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();
app.use(express.json());
app.use(cors());

// === Puppeteer Avanzado con Stealth ===
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const chromium = require('@sparticuz/chromium-min');
puppeteer.use(StealthPlugin());

let browserInstance;
let isLoggedIn = false;

// === Comportamiento humano ===
const humanBehavior = {
  randomDelay: (min = 800, max = 2500) => new Promise(resolve => {
    setTimeout(resolve, min + Math.random() * (max - min));
  }),
  humanScroll: async (page) => {
    await page.evaluate(async () => {
      await new Promise(resolve => {
        let totalHeight = 0;
        const distance = 200;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= scrollHeight || totalHeight > 3000) {
            clearInterval(timer);
            resolve();
          }
        }, 200);
      });
    });
  }
};

// === Login a Instagram ===
async function instagramLogin(page) {
  try {
    console.log("🔐 Iniciando sesión...");
    await page.goto('https://instagram.com/accounts/login/', { waitUntil: 'networkidle2', timeout: 30000 });
    await Promise.race([
      page.waitForSelector('input[name="username"]', { timeout: 15000 }),
      page.waitForSelector('input[aria-label*="usuario"]', { timeout: 15000 })
    ]);
    await humanBehavior.randomDelay(1000, 2000);
    await page.type('input[name="username"]', process.env.IG_USER, { delay: 90 });
    await humanBehavior.randomDelay(800, 1400);
    await page.type('input[name="password"]', process.env.IG_PASS, { delay: 80 });
    await humanBehavior.randomDelay(1000, 1800);
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 })
    ]);
    console.log("✅ Sesión iniciada");
    return true;
  } catch (error) {
    console.error("❌ Login fallido:", error.message);
    return false;
  }
}

// === Navegación protegida ===
async function safeNavigate(page, url) {
  try {
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'es-ES,es;q=0.9',
      'X-Forwarded-For': `35.180.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}`
    });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForSelector('img[src*="instagram"]', { timeout: 15000 });
    await humanBehavior.humanScroll(page);
    await humanBehavior.randomDelay(1000, 3000);
    return true;
  } catch (error) {
    console.error("❌ Navegación fallida:", error.message);
    throw new Error("Instagram bloqueó el acceso o el perfil no existe.");
  }
}

// === Extracción de perfil ===
async function extractProfileData(page) {
  return page.evaluate(() => {
    try {
      const avatar = document.querySelector('header img');
      const usernameElem = document.querySelector('header section h2, header section span');
      const verifiedElem = document.querySelector('svg[aria-label="Verified"], svg[aria-label="Cuenta verificada"]');
      let followers = 'N/A';
      const meta = document.querySelector('meta[property="og:description"]')?.content;
      if (meta && meta.includes('seguidores')) {
        const match = meta.match(/([\d,.]+)\sseguidores/);
        if (match) followers = match[1];
      }
      return {
        username: usernameElem?.textContent || 'N/A',
        fullName: document.querySelector('header h1')?.textContent || 'N/A',
        verified: !!verifiedElem,
        followers,
        profilePic: avatar?.src || ''
      };
    } catch (err) {
      return { error: err.message };
    }
  });
}

// === Inicializa Puppeteer ===
async function initBrowser() {
  try {
    console.log("🚀 Lanzando navegador...");
    browserInstance = await puppeteer.launch({
      executablePath: await chromium.executablePath(),
      args: [...chromium.args, '--disable-dev-shm-usage'],
      headless: chromium.headless
    });
    if (process.env.IG_USER && process.env.IG_PASS) {
      const page = await browserInstance.newPage();
      isLoggedIn = await instagramLogin(page);
      await page.close();
    }
    console.log("✅ Navegador listo");
  } catch (e) {
    console.error("❌ Error al lanzar Chromium:", e.message);
    process.exit(1);
  }
}

// === Endpoints ===
app.get('/api/scrape', async (req, res) => {
  const igUsername = req.query.username;
  if (!igUsername) return res.status(400).json({ error: 'Falta ?username=' });
  if (!browserInstance) return res.status(503).json({ error: 'Sistema aún iniciando.' });

  try {
    const page = await browserInstance.newPage();
    await safeNavigate(page, `https://instagram.com/${igUsername}`);
    const data = await extractProfileData(page);
    await page.close();

    if (data.error) throw new Error(data.error);

    res.json({ profile: data });
  } catch (error) {
    res.status(500).json({
      error: "No se pudo obtener el perfil.",
      reason: error.message,
      debug: true,
      suggestion: "Activa modo screenshot si quieres ver qué está bloqueando Instagram."
    });
  }
});

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
    res.status(500).json({ error: "Error IA" });
  }
});

app.get('/voz-prueba', async (req, res) => {
  try {
    const text = req.query.text || "Hola, Karmean.";
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
    res.status(500).json({ error: "Error Bitly" });
  }
});

// === Arranque ===
const PORT = process.env.PORT || 3000;
initBrowser().then(() => {
  app.listen(PORT, () => {
    console.log(`🟢 Servidor escuchando en puerto ${PORT}`);
  });
});
