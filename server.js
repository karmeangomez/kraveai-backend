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

// Simulación humana
const delay = (min = 800, max = 1500) =>
  new Promise(resolve => setTimeout(resolve, min + Math.random() * (max - min)));

// Login real a Instagram
async function loginInstagram(page) {
  try {
    await page.goto('https://instagram.com/accounts/login/', { waitUntil: 'networkidle2' });
    await page.waitForSelector('input[name="username"]', { timeout: 10000 });

    await page.type('input[name="username"]', process.env.INSTAGRAM_USER, { delay: 80 });
    await delay();
    await page.type('input[name="password"]', process.env.INSTAGRAM_PASS, { delay: 70 });
    await delay();
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2' })
    ]);
    return true;
  } catch (err) {
    console.error("🔒 Login fallido:", err.message);
    return false;
  }
}

// Navegación protegida
async function navegarSeguro(page, url) {
  const userAgents = [
    'Mozilla/5.0 (Linux; Android 13; Pixel 7 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Mobile Safari/604.1'
  ];
  await page.setUserAgent(userAgents[Math.floor(Math.random() * userAgents.length)]);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForSelector('img', { timeout: 10000 });
  await page.waitForTimeout(1500);
}

// Extraer perfil
async function extraerPerfil(page) {
  return page.evaluate(() => {
    const img = document.querySelector('header img')?.src || null;
    const verified = !!document.querySelector('svg[aria-label="Verified"], svg[aria-label="Cuenta verificada"]');
    const user = document.querySelector('header h2')?.textContent || '';
    const name = document.querySelector('header h1')?.textContent || '';
    const seguidores = document.querySelector('meta[property="og:description"]')?.content.match(/([\d.,KM]+)\sseguidores/)?.[1] || 'N/A';
    return { username: user, fullName: name, verified, followers: seguidores, profilePic: img };
  });
}

// Inicializar navegador
async function iniciarBrowser() {
  browserInstance = await puppeteer.launch({
    executablePath: await chromium.executablePath(),
    args: chromium.args,
    headless: chromium.headless
  });

  const page = await browserInstance.newPage();
  isLoggedIn = await loginInstagram(page);
  await page.close();
}

// API IA (OpenAI)
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    const openaiRes = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: message }]
    }, {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    res.json({ message: openaiRes.data.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ error: 'IA falló' });
  }
});

// API Voz
app.get('/voz-prueba', async (req, res) => {
  try {
    const text = req.query.text || "Hola Karmean, tu voz está activa.";
    const r = await axios.post('https://api.openai.com/v1/audio/speech', {
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
    res.send(r.data);
  } catch (err) {
    res.status(500).send("Error generando voz");
  }
});

// API Bitly
app.get('/bitly-prueba', async (req, res) => {
  try {
    const r = await axios.post('https://api-ssl.bitly.com/v4/shorten', {
      long_url: req.query.url || "https://instagram.com"
    }, {
      headers: {
        Authorization: `Bearer ${process.env.BITLY_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    res.json({ shortUrl: r.data.link });
  } catch (err) {
    res.status(500).json({ error: "Bitly falló" });
  }
});

// API Scrape
app.get('/api/scrape', async (req, res) => {
  const username = req.query.username;
  if (!username) return res.status(400).json({ error: "Falta username" });

  try {
    const page = await browserInstance.newPage();
    await navegarSeguro(page, `https://instagram.com/${username}`);
    const data = await extraerPerfil(page);
    await page.close();
    res.json({ profile: data });
  } catch (err) {
    res.status(500).json({ error: "Scraping fallido", details: err.message });
  }
});

// Lanzar
const PORT = process.env.PORT || 3000;
iniciarBrowser().then(() => {
  app.listen(PORT, () => {
    console.log(`🔥 Servidor activo en puerto ${PORT}`);
  });
});
