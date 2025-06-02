// 🚀 server.js COMPLETO PARA KRAVEAI - Versión Final con IA, Voz, Bitly y Scraping Instagram
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

let browserInstance;
let isLoggedIn = false;

// ====================== Comportamiento humano ======================
const humanBehavior = {
  randomDelay: (min = 800, max = 2500) => new Promise(resolve =>
    setTimeout(resolve, min + Math.random() * (max - min))),

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

// ====================== Login Instagram ======================
async function instagramLogin(page) {
  try {
    await page.goto('https://instagram.com/accounts/login/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    const usernameSelector = 'input[name="username"]';
    await page.waitForSelector(usernameSelector, { timeout: 15000 });
    await humanBehavior.randomDelay(1000, 2000);
    await page.type(usernameSelector, process.env.INSTAGRAM_USER, { delay: 80 });
    await humanBehavior.randomDelay(800, 1500);
    await page.type('input[name="password"]', process.env.INSTAGRAM_PASS, { delay: 70 });
    await humanBehavior.randomDelay(1200, 2500);
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 })
    ]);

    return true;
  } catch (error) {
    console.error("[Login IG] Error:", error.message);
    return false;
  }
}

// ====================== Navegación segura ======================
async function safeNavigate(page, url) {
  const userAgents = [
    'Mozilla/5.0 (iPhone14,6) AppleWebKit/602.1.50 (KHTML, like Gecko) Version/15.0 Mobile Safari/602.1',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36'
  ];
  await page.setUserAgent(userAgents[Math.floor(Math.random() * userAgents.length)]);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForSelector('img[data-testid="user-avatar"], header img', { timeout: 25000, visible: true });
  await humanBehavior.humanScroll(page);
  await humanBehavior.randomDelay(1500, 3000);
}

// ====================== Extracción de datos Instagram ======================
async function extractProfileData(page) {
  return page.evaluate(() => {
    try {
      const avatar = document.querySelector('img[data-testid="user-avatar"], header img');
      const usernameElem = document.querySelector('header section h2');
      const verifiedElem = document.querySelector('svg[aria-label="Verified"]');
      const metaDesc = document.querySelector('meta[property="og:description"]')?.content;
      let followers = 'N/A';
      if (metaDesc && /seguidores|followers/i.test(metaDesc)) {
        const match = metaDesc.match(/([\d,.KM]+)\s(seguidores|followers)/i);
        if (match) followers = match[1];
      }
      return {
        username: usernameElem?.textContent || 'N/A',
        fullName: document.querySelector('header h1')?.textContent || 'N/A',
        verified: !!verifiedElem,
        followers,
        profilePic: avatar?.src || 'N/A'
      };
    } catch (error) {
      return { error: "Error en extracción: " + error.message };
    }
  });
}

// ====================== Inicializar navegador ======================
async function initBrowser() {
  browserInstance = await puppeteer.launch({
    executablePath: await chromium.executablePath(),
    args: [...chromium.args, '--disable-dev-shm-usage'],
    headless: chromium.headless,
    ignoreHTTPSErrors: true
  });
  const page = await browserInstance.newPage();
  isLoggedIn = await instagramLogin(page);
  await page.close();
}

// ====================== Rutas API Core ======================

// Scraping Instagram
app.get('/api/scrape', async (req, res) => {
  const igUsername = req.query.username;
  if (!igUsername) return res.status(400).json({ error: "Falta ?username=" });
  if (!browserInstance || !isLoggedIn) return res.status(500).json({ error: "Navegador no listo" });
  try {
    const page = await browserInstance.newPage();
    await safeNavigate(page, `https://instagram.com/${igUsername}`);
    const profileData = await extractProfileData(page);
    await page.close();
    res.json({ profile: profileData });
  } catch (e) {
    res.status(500).json({ error: "Scraping fallido", details: e.message });
  }
});

// IA - ChatGPT
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
  } catch (e) {
    res.status(500).json({ error: "IA falló", details: e.message });
  }
});

// Bitly
app.get('/bitly-prueba', async (req, res) => {
  try {
    const url = req.query.url || 'https://www.instagram.com';
    const response = await axios.post('https://api-ssl.bitly.com/v4/shorten', {
      long_url: url
    }, {
      headers: {
        Authorization: `Bearer ${process.env.BITLY_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    res.json({ shortUrl: response.data.link });
  } catch (e) {
    res.status(500).json({ error: "Bitly falló", details: e.message });
  }
});

// Voz
app.get('/voz-prueba', async (req, res) => {
  try {
    const text = req.query.text || "Hola Karmean, tu voz está activa.";
    const response = await axios.post('https://api.openai.com/v1/audio/speech', {
      model: 'tts-1',
      input: text,
      voice: 'onyx'
    }, {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      responseType: 'arraybuffer'
    });
    res.set('Content-Type', 'audio/mpeg');
    res.send(response.data);
  } catch (e) {
    res.status(500).json({ error: "Voz falló", details: e.message });
  }
});

// ====================== Pruebas ======================
app.get('/test-ia', async (req, res) => {
  const result = await axios.post('https://api.openai.com/v1/chat/completions', {
    model: 'gpt-4o',
    messages: [{ role: 'user', content: 'Hola Karmean' }]
  }, {
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }
  });
  res.json({ respuesta: result.data.choices[0].message.content });
});

app.get('/test-bitly', async (req, res) => {
  const result = await axios.post('https://api-ssl.bitly.com/v4/shorten', {
    long_url: 'https://instagram.com'
  }, {
    headers: { Authorization: `Bearer ${process.env.BITLY_TOKEN}` }
  });
  res.json({ shortUrl: result.data.link });
});

// ====================== Iniciar servidor ======================
const PORT = process.env.PORT || 3000;
initBrowser().then(() => {
  app.listen(PORT, () => console.log(`🚀 Servidor escuchando en puerto ${PORT}`));
});
