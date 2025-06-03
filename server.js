require('dotenv').config();
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const app = express();
app.use(express.json());
app.use(cors());

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const { aplicarFingerprint } = require('./lib/fingerprint-generator');
const { obtenerHeadersGeo } = require('./lib/geo-headers');
const { randomDelay, humanScroll } = require('./lib/human-behavior');
const { getRandomUA } = require('./lib/ua-loader');
const { instagramLogin } = require('./instagramLogin');
const db = require('./lib/firebase');

let browserInstance;
let isLoggedIn = false;

// 🔁 INICIAR CHROMIUM + LOGIN
async function initBrowser() {
  try {
    console.log("🚀 Iniciando Chromium...");
    browserInstance = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: true,
      ignoreHTTPSErrors: true
    });

    const page = await browserInstance.newPage();
    isLoggedIn = await instagramLogin(page, process.env.INSTAGRAM_USER, process.env.INSTAGRAM_PASS, 'default');
    await page.close();

    if (!isLoggedIn) throw new Error("Login fallido");
    console.log("✅ Chromium listo y sesión activa");
  } catch (err) {
    console.error("❌ Error crítico:", err.message);
    process.exit(1);
  }
}

// 🔍 NAVEGAR A PERFIL
async function safeNavigate(page, url) {
  try {
    await page.setUserAgent(getRandomUA('mobile'));
    await page.setExtraHTTPHeaders(obtenerHeadersGeo());
    await aplicarFingerprint(page);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => {
      return (
        document.querySelector('header h1') &&
        document.querySelector('header img') &&
        document.querySelector('meta[property="og:description"]')
      );
    }, { timeout: 40000 });

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

// ✅ SCRAPING INSTAGRAM
app.get('/api/scrape', async (req, res) => {
  const igUsername = req.query.username;
  const targeting = (req.query.targeting || 'GLOBAL').toUpperCase();

  if (!igUsername) return res.status(400).json({ error: "Falta ?username=" });
  if (!browserInstance || !isLoggedIn) return res.status(500).json({ error: "Sistema no preparado" });

  try {
    const page = await browserInstance.newPage();
    console.log(`🔍 Scraping: @${igUsername} | ${targeting}`);
    await safeNavigate(page, `https://instagram.com/${igUsername}`);
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

    await db.collection('clientes').doc(igUsername).set(profileData, { merge: true });
    console.log(`☁️ Guardado en Firestore: ${igUsername}`);
    res.json({ profile: profileData });
  } catch (e) {
    res.status(500).json({ error: "Scraping fallido", reason: e.message });
  }
});

// 🔐 GUARDAR CLIENTE MANUAL DESDE HTML
app.post('/guardar-cliente', async (req, res) => {
  const data = req.body;
  if (!data || !data.username) return res.status(400).json({ error: "Datos incompletos" });
  try {
    await db.collection('clientes').doc(data.username).set(data, { merge: true });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "No se pudo guardar el cliente" });
  }
});

// 📄 LISTAR CLIENTES GUARDADOS
app.get('/firestore/clientes', async (req, res) => {
  try {
    const snapshot = await db.collection('clientes').get();
    const clientes = snapshot.docs.map(doc => doc.data());
    res.json(clientes);
  } catch (e) {
    res.status(500).json({ error: "No se pudo cargar Firestore" });
  }
});

// 🗑️ ELIMINAR CLIENTE
app.delete('/eliminar-cliente/:username', async (req, res) => {
  const { username } = req.params;
  try {
    await db.collection('clientes').doc(username).delete();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "No se pudo eliminar el cliente" });
  }
});

// ✅ CHEQUEO DE CONEXIÓN FIRESTORE
app.get('/firebase-check', async (req, res) => {
  try {
    const test = await db.collection('clientes').limit(1).get();
    if (!test.empty) {
      res.json({ status: 'ok', message: 'Firestore conectado ✅' });
    } else {
      res.json({ status: 'ok', message: 'Firestore vacío pero funcional ✅' });
    }
  } catch (e) {
    console.error("❌ Firestore error:", e.message);
    res.status(500).json({ status: 'error', error: e.message });
  }
});

// ✅ CHEQUEO DE SALUD GENERAL
app.get('/health', (req, res) => {
  res.send('🟢 Server running and healthy!');
});

// 🤖 CHAT IA
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

// 🚀 INICIAR SERVIDOR
const PORT = process.env.PORT || 3000;
initBrowser().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Backend activo en puerto ${PORT}`);
  });
});
