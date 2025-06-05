require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();
app.use(express.json());
app.use(cors());

// Importa el módulo de login mejorado
const { ensureLoggedIn, getCookies } = require('./instagramLogin');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

let browserInstance = null;
let sessionStatus = 'INITIALIZING';

// 🔁 Inicializa navegador y sesión de Instagram
async function initBrowser() {
  try {
    console.log("🚀 Verificando sesión de Instagram...");
    await ensureLoggedIn(); // Usa el nuevo sistema de login
    console.log("✅ Sesión de Instagram lista.");

    console.log("🚀 Iniciando Chromium con Stealth...");
    browserInstance = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        '--single-process'
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome',
      ignoreHTTPSErrors: true
    });

    console.log("✅ Chromium listo.");
    sessionStatus = 'ACTIVE';
    
    // Verificación periódica de sesión
    setInterval(checkSessionValidity, 60 * 60 * 1000); // Cada hora
    
  } catch (err) {
    console.error("❌ Error al iniciar Chromium:", err.message);
    sessionStatus = 'ERROR';
    throw err;
  }
}

// 🔍 Verifica la validez de la sesión
async function checkSessionValidity() {
  try {
    const cookies = getCookies();
    if (!cookies || cookies.length === 0) {
      throw new Error('No hay cookies disponibles');
    }
    
    const page = await browserInstance.newPage();
    await page.setCookie(...cookies);
    
    await page.goto('https://www.instagram.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });
    
    const isLoggedIn = await page.evaluate(() => {
      return document.querySelector('a[href*="/accounts/activity/"]') !== null;
    });
    
    await page.close();
    
    if (!isLoggedIn) {
      console.warn("⚠️ Sesión de Instagram expirada, reiniciando...");
      await ensureLoggedIn();
      console.log("✅ Sesión renovada exitosamente");
    }
    
    sessionStatus = 'ACTIVE';
  } catch (err) {
    console.error("❌ Error verificando sesión:", err.message);
    sessionStatus = 'EXPIRED';
  }
}

// 🔍 Scraping con sesión activa
app.get('/api/scrape', async (req, res) => {
  const username = req.query.username;
  if (!username) return res.status(400).json({ error: "Falta ?username=" });

  // Verificar estado de la sesión
  if (sessionStatus !== 'ACTIVE') {
    return res.status(503).json({ 
      error: "Sesión no disponible", 
      status: sessionStatus,
      message: "Intente nuevamente en unos minutos"
    });
  }

  try {
    const cookies = getCookies();
    if (!cookies || cookies.length === 0) {
      throw new Error('No hay cookies de sesión disponibles');
    }

    const page = await browserInstance.newPage();
    
    // Configuración anti-detección
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9'
    });
    
    // Establecer cookies de sesión
    await page.setCookie(...cookies);

    // Navegación con manejo de errores
    const response = await page.goto(`https://www.instagram.com/${username}/`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Verificar respuesta HTTP
    if (response.status() >= 400) {
      throw new Error(`Página no disponible (HTTP ${response.status()})`);
    }

    // Esperar selectores críticos
    await Promise.race([
      page.waitForSelector('header section', { timeout: 10000 }),
      page.waitForSelector('main', { timeout: 10000 })
    ]);

    const profile = await page.evaluate(() => {
      // Selectores mejorados y compatibles
      const avatar = document.querySelector('header img') || 
                    document.querySelector('img[data-testid="user-avatar"]') ||
                    document.querySelector('img.xpdipgo');
      
      const usernameElem = document.querySelector('header section h2') || 
                          document.querySelector('header h2') ||
                          document.querySelector('h2.xd7yjzq');
      
      const verifiedElem = document.querySelector('svg[aria-label="Verified"]') ||
                          document.querySelector('div.x1qs8t0q');
      
      const fullNameElem = document.querySelector('header section h1') || 
                          document.querySelector('header h1') ||
                          document.querySelector('h1.x1heor9g');
      
      // Método alternativo para seguidores
      let followers = 'N/A';
      const metaDesc = document.querySelector('meta[name="description"]')?.content;
      if (metaDesc) {
        const match = metaDesc.match(/([\d,KM.]+)\s+Followers/);
        if (match) followers = match[1];
      }

      return {
        username: usernameElem?.textContent || 'N/A',
        fullName: fullNameElem?.textContent || 'N/A',
        verified: !!verifiedElem,
        followers,
        profilePic: avatar?.src || 'N/A'
      };
    });

    await page.close();
    res.json({ profile });
  } catch (err) {
    console.error("❌ Scraping fallido:", err.message);
    
    // Intenta renovar sesión si falla
    if (err.message.includes('sesión') || err.message.includes('cookie')) {
      sessionStatus = 'EXPIRED';
      try {
        await ensureLoggedIn();
        sessionStatus = 'ACTIVE';
      } catch (refreshErr) {
        console.error("❌ Error renovando sesión:", refreshErr.message);
      }
    }
    
    res.status(500).json({ 
      error: "Scraping fallido", 
      reason: err.message,
      solution: "Intente nuevamente en 1 minuto"
    });
  }
});

// 🌐 IA - Mantenemos igual
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    const resp = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: message }],
      max_tokens: 500
    }, {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    res.json({ message: resp.data.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ error: "Error IA", details: err.message });
  }
});

// 🔊 Voz - Mantenemos igual
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
      responseType: 'arraybuffer',
      timeout: 30000
    });
    res.set('Content-Type', 'audio/mpeg');
    res.send(response.data);
  } catch (err) {
    res.status(500).send("Error generando voz");
  }
});

// 🔗 Bitly - Mantenemos igual
app.get('/bitly-prueba', async (req, res) => {
  try {
    const longUrl = req.query.url || "https://instagram.com";
    const response = await axios.post("https://api-ssl.bitly.com/v4/shorten", {
      long_url: longUrl
    }, {
      headers: {
        Authorization: `Bearer ${process.env.BITLY_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    res.json({ shortUrl: response.data.link });
  } catch (err) {
    res.status(500).json({ error: "Error Bitly", details: err.message });
  }
});

// 🟢 Health mejorado
app.get('/health', (req, res) => {
  const status = {
    status: sessionStatus,
    browser: browserInstance ? 'ACTIVE' : 'INACTIVE',
    memory: process.memoryUsage().rss,
    uptime: process.uptime()
  };
  res.json(status);
});

// 🔥 Inicio del backend
const PORT = process.env.PORT || 3000;
initBrowser().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Backend activo en puerto ${PORT}`);
    console.log(`🔑 Sesión Instagram: ${sessionStatus}`);
  });
}).catch(err => {
  console.error('❌ Falla crítica - Servidor no iniciado:', err.message);
  process.exit(1);
});
