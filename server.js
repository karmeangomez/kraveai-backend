require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();
app.use(express.json());
app.use(cors());

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const UserAgent = require('user-agents');

// ======================== CONFIGURACIONES AVANZADAS ========================
const cookiesPath = path.join(__dirname, 'cookies.json');
const LOGIN_TIMEOUT = 45000; // 45 segundos para entornos en la nube
const NAVIGATION_TIMEOUT = 30000; // 30 segundos para navegaciones

// ======================== FUNCIONES AUXILIARES ========================
const humanBehavior = {
  randomDelay: (min = 800, max = 2500) => new Promise(resolve => 
    setTimeout(resolve, min + Math.random() * (max - min))),
  
  randomType: async (page, selector, text) => {
    for (let char of text) {
      await page.type(selector, char, { delay: 50 + Math.random() * 100 });
      await humanBehavior.randomDelay(100, 300);
    }
  }
};

// ======================== CORE FUNCTIONS ========================
let browserInstance;
let isLoggedIn = false;

async function instagramLogin(page) {
  try {
    console.log("🔍 Verificando sesión existente...");
    await page.goto('https://www.instagram.com/', { 
      waitUntil: 'domcontentloaded', 
      timeout: NAVIGATION_TIMEOUT 
    });

    // Verificar si ya estamos logueados
    const isLoggedIn = await page.evaluate(() => {
      return document.querySelector('a[href*="/accounts/logout/"]') !== null;
    });

    if (isLoggedIn) {
      console.log("✅ Sesión activa detectada");
      return true;
    }

    console.log("🔐 Iniciando proceso de login...");
    await page.goto('https://www.instagram.com/accounts/login/', {
      waitUntil: 'domcontentloaded',
      timeout: NAVIGATION_TIMEOUT
    });

    // Esperar elementos críticos con múltiples selectores
    await page.waitForFunction(() => {
      const usernameInput = document.querySelector('input[name="username"]');
      const passwordInput = document.querySelector('input[name="password"]');
      return usernameInput && passwordInput;
    }, { timeout: 15000 });

    // Rotar User-Agent
    const userAgent = new UserAgent({ deviceCategory: 'mobile' }).toString();
    await page.setUserAgent(userAgent);
    console.log(`📱 User-Agent actualizado: ${userAgent.substring(0, 50)}...`);

    // Escribir credenciales con comportamiento humano
    await humanBehavior.randomType(page, 'input[name="username"]', process.env.INSTAGRAM_USER);
    await humanBehavior.randomDelay(1000, 2000);
    await humanBehavior.randomType(page, 'input[name="password"]', process.env.INSTAGRAM_PASS);
    await humanBehavior.randomDelay(1500, 3000);

    console.log("🖱️ Haciendo clic en el botón de login...");
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ 
        waitUntil: 'domcontentloaded', 
        timeout: LOGIN_TIMEOUT 
      })
    ]);

    // Manejar posibles desafíos
    await handleLoginChallenges(page);

    console.log("✅ Login exitoso. Guardando cookies...");
    const cookies = await page.cookies();
    fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
    
    return true;
  } catch (error) {
    console.error("❌ Error crítico en login:", error.message);
    
    // Captura de pantalla para diagnóstico
    await page.screenshot({ path: 'login-error.png' });
    console.log("🖼️ Captura de pantalla guardada como login-error.png");
    
    return false;
  }
}

async function handleLoginChallenges(page) {
  try {
    // Desafío 1: Verificación en dos pasos
    const twoFactorSelector = 'input[name="verificationCode"]';
    if (await page.$(twoFactorSelector)) {
      console.warn("⚠️ Instagram requiere verificación en dos pasos");
      // Aquí deberías implementar la lógica para obtener el código 2FA
      await humanBehavior.randomDelay(10000, 15000); // Simula tiempo de espera
    }

    // Desafío 2: "Guardar información de inicio de sesión"
    const notNowButtons = await page.$x('//button[contains(., "Not Now") or contains(., "Ahora no")]');
    if (notNowButtons.length > 0) {
      await notNowButtons[0].click();
      console.log("🚫 Diálogo 'Guardar información' cerrado");
      await humanBehavior.randomDelay(1000, 2000);
    }

    // Desafío 3: Notificaciones
    const notificationButtons = await page.$x('//button[contains(., "Not Now") or contains(., "Ahora no")]');
    if (notificationButtons.length > 0) {
      await notificationButtons[0].click();
      console.log("🔕 Diálogo de notificaciones cerrado");
    }
  } catch (error) {
    console.warn("⚠️ Advertencia en manejo de desafíos:", error.message);
  }
}

async function safeNavigate(page, url) {
  try {
    console.log(`🌐 Navegando a: ${url}`);
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: NAVIGATION_TIMEOUT
    });

    // Esperar elemento clave con timeout extendido
    await page.waitForSelector('header, img[data-testid="user-avatar"], meta[property="og:description"]', {
      timeout: 20000,
      visible: true
    });

    return true;
  } catch (error) {
    console.error("🚫 Error en navegación:", error.message);
    throw new Error("Instagram bloqueó el acceso o perfil no encontrado");
  }
}

async function extractProfileData(page) {
  return page.evaluate(() => {
    try {
      // Selectores resistentes a cambios
      const avatar = document.querySelector('img[data-testid="user-avatar"], header img, img.xpdipgo');
      const usernameElem = document.querySelector('h2.x1lliihq, span._ap3a, header section h2');
      const verifiedElem = document.querySelector('svg[aria-label="Verified"], div[aria-label="Cuenta verificada"]');
      
      // Estrategia múltiple para seguidores
      let followers = 'N/A';
      
      // 1. Intento: Meta tag
      const metaDesc = document.querySelector('meta[property="og:description"]')?.content;
      if (metaDesc && /seguidores|followers/i.test(metaDesc)) {
        const match = metaDesc.match(/([\d,.KM]+)\s(seguidores|followers)/i);
        if (match) followers = match[1];
      } 
      // 2. Intento: Elemento del DOM
      else {
        const followersElem = document.querySelector('ul li a span[title], ul li span[title], header section ul li:nth-child(2) span');
        if (followersElem) followers = followersElem.title || followersElem.textContent;
      }

      return {
        username: usernameElem?.textContent || 'N/A',
        fullName: document.querySelector('h1._ap3a, h1.x1lliihq')?.textContent || 'N/A',
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
    console.log("🚀 Iniciando navegador en modo stealth...");
    
    browserInstance = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--single-process',
        '--disable-gpu',
        '--disable-features=IsolateOrigins,site-per-process'
      ],
      ignoreHTTPSErrors: true,
      timeout: 60000
    });

    const page = await browserInstance.newPage();
    
    // Configuración stealth avanzada
    await page.setJavaScriptEnabled(true);
    await page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT);
    
    // Cargar cookies si existen
    if (fs.existsSync(cookiesPath)) {
      const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
      await page.setCookie(...cookies);
      console.log("🍪 Cookies cargadas desde archivo");
    }

    isLoggedIn = await instagramLogin(page);
    await page.close();

    if (!isLoggedIn) {
      throw new Error("Error de autenticación. Verifica credenciales y captcha");
    }

    console.log("✅ Navegador listo con sesión activa");
  } catch (error) {
    console.error("❌ Error crítico en inicialización:", error.message);
    process.exit(1);
  }
}

// ======================== ENDPOINTS ========================
app.get('/api/scrape', async (req, res) => {
  const igUsername = req.query.username;
  if (!igUsername) return res.status(400).json({ error: "Parámetro ?username requerido" });

  if (!browserInstance || !isLoggedIn) {
    return res.status(503).json({ error: "Sistema no inicializado. Intenta en 1 minuto." });
  }

  try {
    console.log(`🔍 Iniciando scraping para @${igUsername}`);
    const page = await browserInstance.newPage();
    
    // Configuración de página
    await page.setViewport({ width: 375, height: 812, isMobile: true });
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'es-ES,es;q=0.9',
      'X-Forwarded-For': `35.180.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}`
    });

    await safeNavigate(page, `https://instagram.com/${igUsername}`);
    
    const profileData = await extractProfileData(page);
    await page.close();

    if (profileData.error) {
      throw new Error(profileData.error);
    }

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
    console.error(`❌ Error en scraping: ${error.message}`);
    res.status(500).json({
      error: "No se pudo obtener el perfil",
      reason: error.message,
      solution: "Intenta con otro usuario o espera 10 minutos"
    });
  }
});

// ======================== INICIO DEL SERVIDOR ========================
const PORT = process.env.PORT || 3000;

initBrowser().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor activo en http://localhost:${PORT}`);
    console.log("🔍 Endpoint scraping: GET /api/scrape?username=...");
  });
});
