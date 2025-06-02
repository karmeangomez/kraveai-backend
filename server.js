// server.js - KraveAI Backend Híbrido
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

// Comportamiento humano
const humanDelay = (min = 800, max = 2500) => new Promise(resolve => setTimeout(resolve, min + Math.random() * (max - min)));

// Inicializar navegador
async function initBrowser() {
  browserInstance = await puppeteer.launch({
    executablePath: await chromium.executablePath(),
    args: chromium.args,
    headless: chromium.headless,
    defaultViewport: chromium.defaultViewport
  });
  console.log('✅ Navegador listo');
}

// Login a Instagram
async function instagramLogin(page) {
  await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle2' });
  await page.type('input[name="username"]', process.env.IG_USER, { delay: 80 });
  await humanDelay();
  await page.type('input[name="password"]', process.env.IG_PASS, { delay: 80 });
  await humanDelay();
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {})
  ]);
}

// Scraping de perfil
async function scrapeInstagram(username) {
  const page = await browserInstance.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (iPhone; CPU iPhone OS 15_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1'
  );
  await instagramLogin(page);
  await page.goto(`https://www.instagram.com/${username}/`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('header img', { timeout: 15000 });

  const data = await page.evaluate(() => {
    const profilePic = document.querySelector('header img')?.src || null;
    const username = document.querySelector('h2')?.innerText || null;
    const fullName = document.querySelector('h1')?.innerText || null;
    const verified = !!document.querySelector('svg[aria-label="Verified"]');
    const meta = document.querySelector('meta[property="og:description"]')?.content;
    const followers = meta?.match(/([\d,.KM]+)\sseguidores/)?.[1] || null;

    return { profilePic, username, fullName, verified, followers };
  });

  await page.close();
  return data;
}

// Endpoint scraping
app.get('/api/scrape', async (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json({ error: 'Falta username' });
  try {
    const data = await scrapeInstagram(username);
    res.json({ profile: data });
  } catch (err) {
    res.status(500).json({ error: 'Scraping fallido', details: err.message });
  }
});

// Endpoint de IA
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
  } catch (error) {
    res.status(500).json({ error: 'IA falló', details: error.message });
  }
});

// Endpoint voz
app.get('/voz-prueba', async (req, res) => {
  try {
    const text = req.query.text || 'Hola, esta es una prueba de voz.';
    const result = await axios.post(
      'https://api.openai.com/v1/audio/speech',
      {
        model: 'tts-1',
        input: text,
        voice: 'onyx'
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
    res.send(result.data);
  } catch (err) {
    res.status(500).send('Error generando voz.');
  }
});

// Endpoint Bitly
app.get('/bitly-prueba', async (req, res) => {
  try {
    const longUrl = req.query.url;
    if (!longUrl || !longUrl.startsWith('http')) {
      return res.status(400).json({ error: 'URL inválida' });
    }
    const result = await axios.post(
      'https://api-ssl.bitly.com/v4/shorten',
      { long_url: longUrl },
      {
        headers: {
          Authorization: `Bearer ${process.env.BITLY_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    res.json({ shortUrl: result.data.link });
  } catch (err) {
    res.status(500).json({ error: 'Bitly falló', details: err.message });
  }
});

const PORT = process.env.PORT || 3000;
initBrowser().then(() => {
  app.listen(PORT, () => console.log(`🚀 Backend activo en el puerto ${PORT}`));
});
