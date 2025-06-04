// ✅ server.js optimizado - versión estable con IA, Voz, Bitly y login con sesión persistente
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { scrapeInstagram, encryptPassword } = require('./instagramLogin');

puppeteer.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 🕒 Configuración global
let browserInstance = null;
let pageInstance = null;
let encryptedPassword = null; // Almacenar el objeto cifrado una vez

// 🔑 Generar y almacenar la contraseña cifrada al inicio
function initializeEncryptedPassword() {
  const password = process.env.INSTAGRAM_PASS || '';
  if (!password) throw new Error('INSTAGRAM_PASS no está definido');
  encryptedPassword = encryptPassword(password);
  console.log('🔒 Contraseña cifrada inicializada');
}

async function initializeBrowser() {
  try {
    console.log('🚀 Iniciando Puppeteer con Stealth...');
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        '--enable-javascript', // Forzar habilitación de JavaScript
        '--window-size=1366,768'
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome',
      ignoreHTTPSErrors: true,
      timeout: 60000 // Aumentar timeout a 60 segundos
    });

    browserInstance = browser;
    pageInstance = await browser.newPage();
    await pageInstance.setUserAgent(new (require('user-agents'))().toString());
    await pageInstance.setJavaScriptEnabled(true); // Asegurar JavaScript en la página

    if (!encryptedPassword) initializeEncryptedPassword();
    const loginSuccess = await scrapeInstagram(pageInstance, process.env.INSTAGRAM_USER || '', encryptedPassword);
    if (!loginSuccess) {
      throw new Error('Login fallido');
    }

    console.log('✅ Navegador inicializado con sesión activa');
    return { browser, page: pageInstance };
  } catch (err) {
    console.error('❌ Error iniciando navegador:', err.message);
    if (browserInstance) {
      await browserInstance.close();
    }
    browserInstance = null;
    pageInstance = null;
    throw err; // Dejar que Railway maneje el reinicio
  }
}

// 👁️ Monitor de sesión
async function monitorSession() {
  if (!browserInstance || !pageInstance) return;
  try {
    await pageInstance.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    const isLoggedIn = await pageInstance.evaluate(() => !!document.querySelector('a[href*="/direct/inbox/"]'));
    if (!isLoggedIn) {
      console.warn('⚠️ Sesión expirada. Reiniciando...');
      await browserInstance.close();
      browserInstance = null;
      pageInstance = null;
      await initializeBrowser();
    } else {
      setTimeout(monitorSession, 5 * 60 * 1000); // Revisar cada 5 minutos
    }
  } catch (err) {
    console.error('❌ Error en monitor de sesión:', err.message);
    await browserInstance.close();
    browserInstance = null;
    pageInstance = null;
    await initializeBrowser();
  }
}

// 📦 Scraping
app.get('/scrape/:username', async (req, res) => {
  if (!browserInstance || !pageInstance) {
    return res.status(503).json({ error: 'Servicio temporalmente no disponible' });
  }
  const { username } = req.params;
  try {
    if (!encryptedPassword) initializeEncryptedPassword();
    const data = await scrapeInstagram(pageInstance, username, encryptedPassword);
    if (!data) return res.status(500).json({ error: 'No se pudo obtener el perfil' });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: 'Error interno', details: err.message });
  }
});

// 🤖 IA
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
    res.status(500).json({ error: 'Error IA', details: err.message });
  }
});

// 🔊 Voz
app.get('/voz-prueba', async (req, res) => {
  try {
    const text = req.query.text || "Hola, esta es una voz generada con IA.";
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

// 🔗 Bitly
app.get('/bitly-prueba', async (req, res) => {
  try {
    const longUrl = req.query.url || 'https://instagram.com';
    const response = await axios.post('https://api-ssl.bitly.com/v4/shorten', {
      long_url: longUrl
    }, {
      headers: {
        Authorization: `Bearer ${process.env.BITLY_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    res.json({ shortUrl: response.data.link });
  } catch (err) {
    res.status(500).json({ error: 'Error Bitly', details: err.message });
  }
});

// 🩺 Salud
app.get('/health', (req, res) => {
  res.send('🟢 Servidor activo y saludable');
});

// 🟢 Iniciar
(async () => {
  try {
    await initializeBrowser();
    monitorSession();
    app.listen(PORT, () => {
      console.log(`🚀 Backend activo en puerto ${PORT}`);
    });
  } catch (err) {
    console.error('❌ Fallo al iniciar el servidor:', err.message);
    process.exit(1); // Permitir que Railway reinicie el contenedor
  }
})();
