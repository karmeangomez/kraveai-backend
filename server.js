require('dotenv').config();
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { aplicarFingerprint } = require('./lib/fingerprint-generator');
const { obtenerHeadersGeo } = require('./lib/geo-headers');
const { randomDelay, humanScroll } = require('./lib/human-behavior');
const { getRandomUA } = require('./lib/ua-loader');
const { instagramLogin } = require('./instagramLogin');

puppeteer.use(StealthPlugin());

const app = express();
app.use(express.json());
app.use(cors());

let browserInstance;
let isLoggedIn = false;

// 🔁 PROXY ROTATION
const proxyList = [];
let proxyIndex = 0;

async function updateProxies() {
  try {
    const res = await axios.get('https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=10000&country=all');
    proxyList.push(...res.data.split('\n').filter(p => p));
    console.log(`📡 Cargados ${proxyList.length} proxies`);
  } catch (err) {
    console.warn("⚠️ No se pudo actualizar proxies:", err.message);
  }
}

function getNextProxy() {
  if (proxyIndex % 10 === 0) updateProxies().catch(() => {});
  const proxy = proxyList[proxyIndex] || '';
  proxyIndex = (proxyIndex + 1) % proxyList.length || 0;
  return proxy;
}

// 🔁 INICIAR CHROMIUM + LOGIN CON EVASIÓN Y PROXY
async function initBrowser() {
  try {
    console.log("🚀 Iniciando Chromium...");
    const proxy = getNextProxy();
    browserInstance = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--enable-javascript',
        '--disable-blink-features=AutomationControlled',
        proxy ? `--proxy-server=http://${proxy}` : ''
      ],
      headless: true,
      ignoreHTTPSErrors: true
    });

    const testPage = await browserInstance.newPage();
    await testPage.goto('https://www.google.com', { timeout: 10000 }).catch(err => {
      console.error("❌ Error de red o sin conexión:", err.message);
      throw err;
    });
    await testPage.close();

    const loginPage = await browserInstance.newPage();
    const ua = getRandomUA('mobile');
    await loginPage.setUserAgent(ua);
    await loginPage.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      window.navigator.chrome = { runtime: {} };
      Object.defineProperty(navigator, 'languages', { get: () => ['es-ES', 'es'] });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4] });
    });

    isLoggedIn = await instagramLogin(loginPage, process.env.INSTAGRAM_USER, process.env.INSTAGRAM_PASS, 'default');
    await loginPage.close();

    if (!isLoggedIn) {
      console.warn("⚠️ Login fallido. Reintentando en 60 segundos...");
      setTimeout(initBrowser, 60000);
    } else {
      console.log("✅ Chromium listo y sesión activa");
    }
  } catch (err) {
    console.error("❌ Error iniciando Chromium:", err.message);
    setTimeout(initBrowser, 60000);
  }
}

// 🔍 NAVEGAR A PERFIL
async function safeNavigate(page, url, isTurbo = false) {
  try {
    const turboGoto = isTurbo ? 10000 : 30000;
    const turboWait = isTurbo ? 12000 : 40000;

    if (isTurbo) console.log("⚡ Modo Turbo ACTIVADO para esta búsqueda");

    await page.setUserAgent(getRandomUA('mobile'));
    await page.setExtraHTTPHeaders(obtenerHeadersGeo());
    await aplicarFingerprint(page);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: turboGoto });

    await page.waitForFunction(() => {
      return (
        document.querySelector('header h1') &&
        document.querySelector('header img') &&
        document.querySelector('meta[property="og:description"]')
      );
    }, { timeout: turboWait });

    await humanScroll(page);
    await randomDelay(1500, 3000);
    return true;
  } catch (e) {
    throw new Error("Instagram bloqueó el acceso o el perfil no cargó completamente.");
  }
}

// 📦 EXTRAER DATOS
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

// ✅ ENDPOINT DE SCRAPING
app.get('/api/scrape', async (req, res) => {
  const igUsername = req.query.username;
  const targeting = (req.query.targeting || 'GLOBAL').toUpperCase();
  const isTurbo = req.query.turbo === 'true';

  if (!igUsername) return res.status(400).json({ error: "Falta ?username=" });
  if (!browserInstance || !isLoggedIn) return res.status(500).json({ error: "Sistema no preparado" });

  try {
    const page = await browserInstance.newPage();
    console.log(`🔍 Scraping: @${igUsername} | ${targeting}`);
    await safeNavigate(page, `https://instagram.com/${igUsername}`, isTurbo);
    const data = await extractProfileData(page);
    await page.close();

    const flags = targeting === 'LATAM'
      ? ['🇲🇽', '🇦🇷', '🇨🇴', '🇨🇱', '🇵🇪', '🇻🇪']
      : ['🌍'];

    const profileData = {
      ...data,
      username: igUsername,
      targeting,
      countryFlags: flags,
      url: `https://instagram.com/${igUsername}`,
      createdAt: new Date().toISOString()
    };

    res.json({ profile: profileData });
  } catch (e) {
    res.status(500).json({ error: "Scraping fallido", reason: e.message });
  }
});

// ✅ SALUD
app.get('/health', (req, res) => {
  res.send('🟢 Server running and healthy!');
});

// 🧠 IA GPT
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

// 🔊 VOZ
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

// 🔗 BITLY
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

// 🔥 INICIAR SERVER
const PORT = process.env.PORT || 3000;
initBrowser().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Backend activo en puerto ${PORT}`);
  });
});
