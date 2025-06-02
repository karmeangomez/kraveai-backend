
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

const { aplicarFingerprint } = require('./lib/fingerprint-generator');
const { obtenerHeadersGeo } = require('./lib/geo-headers');
const { randomDelay, humanScroll } = require('./lib/human-behavior');
const { getRandomUA } = require('./lib/ua-loader');

let browserInstance;
let isLoggedIn = false;

const cookiesPath = path.join(__dirname, 'cookies.json');


async function instagramLogin(page) {
  try {
    console.log("🔐 Verificando si ya hay sesión...");
    await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle2', timeout: 30000 });

    if (await page.$('input[name="username"]') === null) {
      console.log("✅ Ya estás logueado, no se necesita login.");
      return true;
    }

    console.log("🔐 Iniciando sesión...");
    await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('input[name="username"]', { timeout: 20000 });

    await randomDelay();
    await page.type('input[name="username"]', process.env.INSTAGRAM_USER, { delay: 80 });
    await randomDelay();
    await page.type('input[name="password"]', process.env.INSTAGRAM_PASS, { delay: 70 });
    await randomDelay();

    await page.click('button[type="submit"]');

    await Promise.race([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }),
      randomDelay(6000, 8000)
    ]);

    const error = await page.$('#slfErrorAlert');
    if (error) {
      const message = await page.$eval('#slfErrorAlert', el => el.textContent);
      console.error("❌ Instagram rechazó el login:", message);
      return false;
    }

    console.log("✅ Login exitoso. Guardando cookies...");
    const cookies = await page.cookies();
    const fs = require('fs');
    const path = require('path');
    const cookiesPath = path.join(__dirname, 'cookies.json');
    fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));

    return true;
  } catch (err) {
    console.error("❌ Error en login:", err.message);
    return false;
  }
}


    console.log("🔐 Iniciando sesión...");

    await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('input[name="username"]', { timeout: 20000 });

    await randomDelay();
    await page.type('input[name="username"]', process.env.INSTAGRAM_USER, { delay: 80 });
    await randomDelay();
    await page.type('input[name="password"]', process.env.INSTAGRAM_PASS, { delay: 70 });
    await randomDelay();

    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 })
    ]);

    const error = await page.$('#slfErrorAlert');
    if (error) {
      const message = await page.$eval('#slfErrorAlert', el => el.textContent);
      console.error("❌ Instagram rechazó el login:", message);
      return false;
    }

    console.log("✅ Login exitoso. Guardando cookies...");
    const cookies = await page.cookies();
    fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));

    return true;
  } catch (err) {
    console.error("❌ Error en login:", err.message);
    return false;
  }
}

async function safeNavigate(page, url) {
  try {
    await page.setUserAgent(getRandomUA('mobile'));
    await page.setExtraHTTPHeaders(obtenerHeadersGeo());
    await aplicarFingerprint(page);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForSelector('img[data-testid="user-avatar"], header img', { timeout: 15000 });
    await humanScroll(page);
    await randomDelay();
    return true;
  } catch (e) {
    throw new Error("Instagram bloqueó el acceso o perfil inexistente");
  }
}

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

    // Restaurar cookies si existen
    if (fs.existsSync(cookiesPath)) {
      const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf-8'));
      if (cookies.length) {
        await page.setCookie(...cookies);
        console.log("🍪 Cookies cargadas.");
      }
    }

    isLoggedIn = await instagramLogin(page);
    await page.close();

    if (!isLoggedIn) throw new Error("Login fallido");
    console.log("✅ Chromium listo y sesión activa");
  } catch (err) {
    console.error("❌ Error crítico:", err.message);
    process.exit(1);
  }
}

app.get('/api/scrape', async (req, res) => {
  const igUsername = req.query.username;
  const targeting = (req.query.targeting || 'GLOBAL').toUpperCase();

  if (!igUsername) return res.status(400).json({ error: "Falta ?username=" });
  if (!browserInstance || !isLoggedIn) {
    console.error("⛔ Sistema no preparado (sin Chromium o login)");
    return res.status(500).json({ error: "Sistema no preparado" });
  }

  console.log(`🔍 Scraping iniciado para: @${igUsername} | Targeting: ${targeting}`);

  try {
    const page = await browserInstance.newPage();
    console.log("🧠 Nueva pestaña abierta...");

    await safeNavigate(page, `https://instagram.com/${igUsername}`);
    console.log("✅ Navegación completada. Extrayendo datos...");

    const data = await extractProfileData(page);
    console.log("📦 Datos extraídos:", data);

    await page.close();
    console.log("🚪 Página cerrada correctamente");

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

    console.log("📤 Respuesta enviada al cliente.");
    res.json({ profile: profileData });
  } catch (e) {
    console.error("❌ Scraping fallido:", e.message);
    res.status(500).json({ error: "Scraping fallido", reason: e.message });
  }
});

const PORT = process.env.PORT || 3000;
initBrowser().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor activo en puerto ${PORT}`);
  });
});
