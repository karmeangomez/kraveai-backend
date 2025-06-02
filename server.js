require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();
app.use(express.json());
app.use(cors());

// ====================== [SCRAPING AVANZADO] ======================
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const chromium = require('@sparticuz/chromium-min');
puppeteer.use(StealthPlugin());

let browserInstance;
let isLoggedIn = false;

// 1. Comportamiento humano CORREGIDO
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

// 2. Login profesional COMPLETO
async function instagramLogin(page) {
  try {
    console.log("🔐 Iniciando sesión automática...");
    await page.goto('https://instagram.com/accounts/login/', { 
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Esperar elementos con timeout independiente
    await Promise.race([
      page.waitForSelector('input[name="username"]', { timeout: 10000 }),
      page.waitForSelector('input[aria-label*="usuario"]', { timeout: 10000 })
    ]);

    // Escribir credenciales con delays humanos
    await humanBehavior.randomDelay(1000, 2000);
    await page.type('input[name="username"]', process.env.IG_USER, { delay: 90 });
    await humanBehavior.randomDelay(500, 1200);
    await page.type('input[name="password"]', process.env.IG_PASS, { delay: 80 });
    
    // Click con retraso humano
    await humanBehavior.randomDelay(1000, 2000);
    await page.click('button[type="submit"]');
    
    // Esperar indicadores de login exitoso
    await Promise.race([
      page.waitForSelector('div[data-testid="user-avatar"]', { timeout: 15000 }),
      page.waitForSelector('section main', { timeout: 15000 }),
      page.waitForNavigation({ timeout: 15000 })
    ]);

    console.log("✅ Sesión iniciada correctamente");
    return true;
  } catch (error) {
    console.error("❌ Error en login:", error.message);
    return false;
  }
}

// 3. Navegación anti-bloqueo COMPLETA
async function safeNavigate(page, url) {
  try {
    // Configuración stealth avanzada
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'es-ES,es;q=0.9',
      'X-Forwarded-For': `35.180.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}`
    });
    
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 25000
    });

    // Esperar elemento clave (selectores actualizados 2025)
    await page.waitForSelector('img[data-testid="user-avatar"], img[src*="instagram.com/v/"], header img', { 
      timeout: 15000,
      visible: true
    });

    // Comportamiento humano
    await humanBehavior.humanScroll(page);
    await humanBehavior.randomDelay(1500, 3000);

    return true;
  } catch (error) {
    console.error("🚫 Error en navegación:", error.message);
    throw new Error("Instagram bloqueó el acceso o el perfil no existe");
  }
}

// 4. Extracción de datos confiable COMPLETA
async function extractProfileData(page) {
  return page.evaluate(() => {
    try {
      // Selectores actualizados (Julio 2025)
      const avatar = document.querySelector('img[data-testid="user-avatar"], header img');
      const usernameElem = document.querySelector('header section h2, span[title="Nombre de usuario"]');
      const verifiedElem = document.querySelector('svg[aria-label="Verified"], svg[aria-label="Cuenta verificada"]');
      
      // Seguidores con múltiples estrategias
      let followers = 'N/A';
      const metaDesc = document.querySelector('meta[property="og:description"]')?.content;
      
      // Estrategia 1: Meta tag
      if (metaDesc && metaDesc.includes('seguidores')) {
        const match = metaDesc.match(/([\d,.KM]+)\sseguidores/);
        if (match) followers = match[1];
      } 
      // Estrategia 2: Elemento del DOM
      else {
        const followersElem = document.querySelector('header li:nth-child(2) a span, header section ul li:nth-child(2) span');
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

// 5. Inicialización del navegador COMPLETA
async function initBrowser() {
  try {
    console.log("🚀 Iniciando Chromium en modo stealth...");
    
    browserInstance = await puppeteer.launch({
      executablePath: await chromium.executablePath(),
      args: [...chromium.args, '--disable-dev-shm-usage'],
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    // Solo login si hay credenciales
    if (process.env.IG_USER && process.env.IG_PASS) {
      const page = await browserInstance.newPage();
      isLoggedIn = await instagramLogin(page);
      await page.close();
      
      if (!isLoggedIn) {
        throw new Error("Error de autenticación en Instagram. Verifica IG_USER/IG_PASS");
      }
    } else {
      console.warn("⚠️ No se configuraron IG_USER/IG_PASS. Scraping en modo público limitado");
    }

    console.log("✅ Chromium listo!");
  } catch (error) {
    console.error("❌ Error crítico:", error.message);
    process.exit(1);
  }
}

// ====================== [TUS MÓDULOS IA/APIs] ======================

// 1. Chat IA
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
    console.error("[Chat] Error:", err.response?.data || err.message);
    res.status(500).json({ error: "Error en servicio IA" });
  }
});

// 2. Acortador Bitly
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
    console.error("[Bitly] Error:", err.response?.data || err.message);
    res.status(500).json({ error: "Error en acortador" });
  }
});

// 3. Generador de voz
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
    console.error("[Voz] Error:", err.response?.data || err.message);
    res.status(500).send("Error generando voz");
  }
});

// ====================== [SCRAPER OPTIMIZADO] ======================
app.get('/api/scrape', async (req, res) => {
  const igUsername = req.query.username;
  if (!igUsername) return res.status(400).json({ error: "Falta parámetro ?username=" });

  if (!browserInstance) {
    return res.status(500).json({ error: "Sistema no preparado. Intenta en 1 minuto." });
  }
  
  try {
    const page = await browserInstance.newPage();
    
    // Configuración inicial
    await page.setJavaScriptEnabled(true);
    await page.setDefaultNavigationTimeout(30000);
    
    // Navegación segura
    await safeNavigate(page, `https://instagram.com/${igUsername}`);
    
    // Extracción de datos
    const profileData = await extractProfileData(page);
    
    // Cerrar página después de uso
    await page.close();

    // Verificar error en extracción
    if (profileData.error) {
      throw new Error(profileData.error);
    }

    // Formatear respuesta
    res.json({
      profile: {
        username: profileData.username,
        fullName: profileData.fullName,
        verified: profileData.verified,
        followers: profileData.followers,
        profilePic: profileData.profilePic
      }
    });
    
  } catch (error) {
    res.status(500).json({
      error: "No se pudo obtener el perfil",
      reason: error.message,
      solution: "Intenta nuevamente en 5 minutos o usa otro usuario"
    });
  }
});

// ====================== [MANEJO DE ERRORES GLOBAL] ======================
app.use((err, req, res, next) => {
  console.error("🔥 Error global:", err.stack);
  res.status(500).json({ error: "Error interno del servidor" });
});

// ====================== [INICIO DEL SISTEMA] ======================
const PORT = process.env.PORT || 3000;

// Iniciar primero Chromium, luego el servidor
initBrowser().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Backend activo en puerto ${PORT}`);
    console.log("✅ Chromium preparado con sesión activa");
    console.log("🔍 Endpoint scraping: GET /api/scrape?username=...");
    console.log("💬 Endpoint chat: POST /api/chat");
    console.log("🔗 Endpoint Bitly: GET /bitly-prueba?url=...");
    console.log("🎤 Endpoint voz: GET /voz-prueba?text=...");
  });
});
