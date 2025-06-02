// server.js

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

async function instagramLogin(page) {
  try {
    console.log("🔐 Iniciando sesión automática...");
    await page.goto('https://instagram.com/accounts/login/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    const usernameSelector = 'input[name="username"], input[aria-label="Teléfono, usuario o correo electrónico"]';
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

    console.log("✅ Sesión iniciada correctamente");
    return true;
  } catch (error) {
    console.error("❌ Error en login:", error.message);
    return false;
  }
}

async function safeNavigate(page, url) {
  try {
    const mobileAgents = [
      'Mozilla/5.0 (iPhone14,6; U; CPU iPhone OS 15_4 like Mac OS X) AppleWebKit/602.1.50 (KHTML, like Gecko) Version/15.0 Mobile/19E241 Safari/602.1',
      'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36'
    ];
    await page.setUserAgent(mobileAgents[Math.floor(Math.random() * mobileAgents.length)]);

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 25000
    });

    await page.waitForSelector('img[data-testid="user-avatar"], img[src*="instagram.com/v/"]', {
      timeout: 15000,
      visible: true
    });

    await humanBehavior.humanScroll(page);
    await humanBehavior.randomDelay(1500, 3000);

    return true;
  } catch (error) {
    console.error("🚫 Navegación fallida:", error.message);
    throw new Error("Instagram bloqueó el acceso");
  }
}

async function extractProfileData(page) {
  return page.evaluate(() => {
    try {
      const avatar = document.querySelector('img[data-testid="user-avatar"], header img');
      const usernameElem = document.querySelector('header section h2, span[title="Nombre de usuario"]');
      const verifiedElem = document.querySelector('svg[aria-label="Verified"], svg[aria-label="Cuenta verificada"]');

      let followers = 'N/A';
      const metaDesc = document.querySelector('meta[property="og:description"]')?.content;
      if (metaDesc && metaDesc.includes('seguidores')) {
        followers = metaDesc.match(/([\d,.KM]+)\sseguidores/)[1];
      } else {
        const followersElem = document.querySelector('header li:nth-child(2) a span');
        if (followersElem) followers = followersElem.title || followersElem.textContent;
      }

      return {
        username: usernameElem?.textContent || 'N/A',
        fullName: document.querySelector('header h1, div[role="presentation"] h1')?.textContent || 'N/A',
        verified: !!verifiedElem,
        followers: followers,
        profilePic: avatar?.src || 'N/A'
      };
    } catch (error) {
      return { error: "Error en extracción: " + error.message };
    }
  });
}

async function initBrowser() {
  try {
    console.log("🚀 Iniciando Chromium en modo stealth...");
    browserInstance = await puppeteer.launch({
      executablePath: await chromium.executablePath(),
      args: [...chromium.args, '--disable-dev-shm-usage'],
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    if (process.env.INSTAGRAM_USER && process.env.INSTAGRAM_PASS) {
      const page = await browserInstance.newPage();
      isLoggedIn = await instagramLogin(page);
      await page.close();
      if (!isLoggedIn) throw new Error("Error de autenticación");
    }

    console.log("✅ Chromium listo!");
  } catch (error) {
    console.error("❌ Error crítico:", error.message);
    process.exit(1);
  }
}

// ====================== [APIs FUNCIONALES] ======================

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
    res.status(500).json({ error: "Error en servicio IA" });
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
    console.error("[Bitly] Error:", err.message);
    res.status(500).json({ error: "Error en acortador" });
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
    console.error("[Voz] Error:", err.message);
    res.status(500).send("Error generando voz");
  }
});

// ====================== [SCRAPER INSTAGRAM] ======================

app.get('/api/scrape', async (req, res) => {
  const igUsername = req.query.username;
  if (!igUsername) return res.status(400).json({ error: "Falta ?username=" });

  if (!browserInstance || !isLoggedIn) {
    return res.status(500).json({ error: "Sistema no preparado. Intenta en 1 minuto." });
  }

  try {
    const page = await browserInstance.newPage();
    await safeNavigate(page, `https://instagram.com/${igUsername}`);

    const profileData = await extractProfileData(page);
    await page.close();

    res.json({ profile: profileData });

  } catch (error) {
    res.status(500).json({
      error: "No se pudo obtener el perfil",
      reason: error.message,
      solution: "Intenta nuevamente en 5 minutos o usa otro usuario"
    });
  }
});

const PORT = process.env.PORT || 3000;
initBrowser().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Backend activo en puerto ${PORT}`);
  });
});
