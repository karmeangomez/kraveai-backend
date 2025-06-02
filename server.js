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

const humanBehavior = {
  randomDelay: (min = 800, max = 2500) => new Promise(resolve => setTimeout(resolve, min + Math.random() * (max - min))),
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
    await page.goto('https://instagram.com/accounts/login/', { waitUntil: 'networkidle2', timeout: 30000 });
    const usernameSelector = 'input[name="username"]';
    await page.waitForSelector(usernameSelector, { timeout: 15000 });
    await humanBehavior.randomDelay();
    await page.type(usernameSelector, process.env.INSTAGRAM_USER, { delay: 80 });
    await humanBehavior.randomDelay();
    await page.type('input[name="password"]', process.env.INSTAGRAM_PASS, { delay: 80 });
    await humanBehavior.randomDelay();
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 })
    ]);
    return true;
  } catch (error) {
    console.error("Login fallido:", error.message);
    return false;
  }
}

async function safeNavigate(page, url) {
  try {
    await page.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Mobile/15E148 Safari/604.1");
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForSelector('img[src*="instagram.com"]', { timeout: 25000 });
    await humanBehavior.humanScroll(page);
    return true;
  } catch (error) {
    throw new Error("Instagram bloqueado o perfil inaccesible");
  }
}

async function extractProfileData(page) {
  return page.evaluate(() => {
    try {
      const avatar = document.querySelector('img[src*="instagram"]');
      const usernameElem = document.querySelector('header h2');
      const verifiedElem = document.querySelector('svg[aria-label="Verified"]');
      const metaDesc = document.querySelector('meta[property="og:description"]')?.content;
      const followers = metaDesc?.match(/([\d,.KM]+)\s(seguidores|followers)/i)?.[1] || 'N/A';

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

async function initBrowser() {
  browserInstance = await puppeteer.launch({
    executablePath: await chromium.executablePath(),
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    headless: chromium.headless,
    ignoreHTTPSErrors: true,
  });
  const page = await browserInstance.newPage();
  isLoggedIn = await instagramLogin(page);
  await page.close();
}

app.get('/api/scrape', async (req, res) => {
  const username = req.query.username;
  if (!username) return res.status(400).json({ error: 'Falta el nombre de usuario' });
  try {
    const page = await browserInstance.newPage();
    await safeNavigate(page, `https://www.instagram.com/${username}/`);
    const data = await extractProfileData(page);
    await page.close();
    if (data.error) throw new Error(data.error);
    res.json({ profile: data });
  } catch (err) {
    res.status(500).json({ error: 'Scraping fallido', details: err.message });
  }
});

app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  try {
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
    res.status(500).json({ error: 'Error IA', details: err.message });
  }
});

app.get('/voz-prueba', async (req, res) => {
  try {
    const text = req.query.text || "Hola, tu voz está activa.";
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
    res.status(500).send('Error voz');
  }
});

app.get('/bitly-prueba', async (req, res) => {
  try {
    const longUrl = req.query.url;
    if (!longUrl || !longUrl.startsWith('http')) {
      return res.status(400).json({ error: "URL inválida" });
    }
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
    res.status(500).json({ error: 'Bitly falló', details: err.message });
  }
});

const PORT = process.env.PORT || 3000;
initBrowser().then(() => {
  app.listen(PORT, () => {
    console.log(`Servidor activo en puerto ${PORT}`);
  });
});
