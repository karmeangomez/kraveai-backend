// ✅ server.js completo: Instagram + IA + Telegram + Frontend con proxies
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const { createMultipleAccounts } = require('./instagramAccountCreator'); // Asegúrate de que exista
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { ensureLoggedIn, getCookies, notifyTelegram } = require('./instagramLogin');
const fs = require('fs').promises;
const UserAgent = require('user-agents'); // Añadido

puppeteer.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 3000;
let browserInstance = null;
let sessionStatus = 'INITIALIZING';
let proxyIndex = 0;
let proxies = [];

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, '.')));

// 🔐 Carga proxies desde proxies.json
async function loadProxies() {
  try {
    const data = await fs.readFile(path.join(__dirname, 'proxies.json'), 'utf8');
    proxies = JSON.parse(data);
    console.log(`📡 Cargados ${proxies.length} proxies desde proxies.json`);
  } catch (err) {
    console.warn('⚠️ No se pudo cargar proxies.json, iniciando extracción:', err.message);
    await scrapeProxies(); // Extrae proxies si no existe
  }
  if (proxies.length === 0) {
    console.warn('⚠️ Lista de proxies vacía, intentando extracción adicional...');
    await scrapeProxies();
  }
}

// 🔍 Extrae proxies (con todas las fuentes)
async function scrapeProxies() {
  console.log('🔍 Iniciando extracción de proxies...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome',
  });
  const page = await browser.newPage();
  const userAgent = new UserAgent();
  await page.setUserAgent(userAgent.toString());

  const proxySources = [
    {
      name: 'ProxyScrape',
      url: 'https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=10000&country=all&simplified=true',
      type: 'api',
      parse: (data) => data.split('\n').map(line => line.trim()).filter(line => line),
    },
    {
      name: 'FreeProxyList',
      url: 'https://free-proxy-list.net/',
      type: 'html',
      parse: async (page) => {
        await page.goto('https://free-proxy-list.net/', { waitUntil: 'load', timeout: 30000 });
        return await page.evaluate(() => {
          const rows = document.querySelectorAll('#list table tbody tr');
          return Array.from(rows).map(row => {
            const ip = row.cells[0].textContent.trim();
            const port = row.cells[1].textContent.trim();
            return `${ip}:${port}`;
          }).filter(line => line.match(/^\d+\.\d+\.\d+\.\d+:\d+$/));
        });
      },
    },
    {
      name: 'SpysOne',
      url: 'https://spys.one/en/http-proxy-list/',
      type: 'html',
      parse: async (page) => {
        await page.goto('https://spys.one/en/http-proxy-list/', { waitUntil: 'load', timeout: 30000 });
        return await page.evaluate(() => {
          const rows = document.querySelectorAll('table tr.spy1xx, tr.spy1x');
          return Array.from(rows).slice(1).map(row => {
            const ipPort = row.cells[0].textContent.trim();
            return ipPort.match(/^\d+\.\d+\.\d+\.\d+:\d+$/) ? ipPort : '';
          }).filter(line => line);
        });
      },
    },
    {
      name: 'Hidemy',
      url: 'https://hidemy.name/en/proxy-list/?type=hs',
      type: 'html',
      parse: async (page) => {
        await page.goto('https://hidemy.name/en/proxy-list/?type=hs', { waitUntil: 'load', timeout: 30000 });
        return await page.evaluate(() => {
          const rows = document.querySelectorAll('.table_block tbody tr');
          return Array.from(rows).map(row => {
            const ip = row.cells[0].textContent.trim();
            const port = row.cells[1].textContent.trim();
            return `${ip}:${port}`;
          }).filter(line => line.match(/^\d+\.\d+\.\d+\.\d+:\d+$/));
        });
      },
    },
  ];

  try {
    const results = await Promise.allSettled(
      proxySources.map(async (source) => {
        try {
          console.log(`🌐 Extrayendo de ${source.name}...`);
          let proxies;
          if (source.type === 'api') {
            const response = await axios.get(source.url, { timeout: 30000 });
            proxies = source.parse(response.data);
          } else {
            proxies = await source.parse(page);
          }
          console.log(`✅ ${source.name}: ${proxies.length} proxies encontrados`);
          return proxies;
        } catch (error) {
          console.error(`❌ Error en ${source.name}: ${error.message}`);
          await notifyTelegram(`❌ Error al extraer proxies de ${source.name}: ${error.message}`);
          return [];
        }
      })
    );

    proxies = results
      .filter(result => result.status === 'fulfilled')
      .flatMap(result => result.value)
      .filter(proxy => proxy.match(/^\d+\.\d+\.\d+\.\d+:\d+$/));

    console.log(`🔥 Total proxies encontrados: ${proxies.length}`);
    await fs.writeFile(path.join(__dirname, 'proxies.json'), JSON.stringify(proxies, null, 2));
    await notifyTelegram(`✅ Extracción de proxies completada: ${proxies.length} proxies encontrados`);
  } finally {
    await browser.close();
  }
}

// 🔐 Inicia navegador y login Instagram con proxies
async function initBrowser() {
  await loadProxies(); // Carga proxies al iniciar
  try {
    console.log("🚀 Verificando sesión de Instagram...");
    const proxy = proxies[proxyIndex];
    proxyIndex = (proxyIndex + 1) % proxies.length;

    browserInstance = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        '--single-process',
        '--js-flags=--max-old-space-size=256',
        proxy ? `--proxy-server=http://${proxy}` : ''
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome',
      ignoreHTTPSErrors: true
    });

    await ensureLoggedIn();
    console.log("✅ Sesión de Instagram lista con proxy:", proxy);

    sessionStatus = 'ACTIVE';
    setInterval(checkSessionValidity, 60 * 60 * 1000); // Verifica cada hora
  } catch (err) {
    console.error("❌ Error al iniciar Chromium:", err.message);
    sessionStatus = 'ERROR';
    notifyTelegram(`❌ Error al iniciar sesión de Instagram: ${err.message}`);
    await restartBrowser(); // Intenta reiniciar si falla
  }
}

// 🔁 Verifica sesión cada hora
async function checkSessionValidity() {
  if (!browserInstance) {
    sessionStatus = 'INACTIVE';
    await restartBrowser();
    return;
  }

  try {
    const cookies = getCookies();
    if (!cookies || cookies.length === 0) throw new Error('No hay cookies disponibles');

    const page = await browserInstance.newPage();
    await page.setCookie(...cookies);
    await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 15000 });

    const isLoggedIn = await page.evaluate(() => {
      return document.querySelector('a[href*="/accounts/activity/"]') !== null;
    });

    await page.close();
    if (!isLoggedIn) {
      console.warn("⚠️ Sesión expirada, reintentando login...");
      await ensureLoggedIn();
      console.log("✅ Sesión renovada exitosamente");
    }
    sessionStatus = 'ACTIVE';
  } catch (err) {
    console.error("❌ Error verificando sesión:", err.message);
    sessionStatus = 'EXPIRED';
    notifyTelegram(`⚠️ Sesión de Instagram expirada: ${err.message}`);
    await restartBrowser(); // Reinicia si la sesión falla
  }
}

// 🔄 Reinicia el navegador en caso de fallo
async function restartBrowser() {
  if (browserInstance) {
    console.log('🔄 Cerrando navegador existente...');
    await browserInstance.close();
  }
  browserInstance = null;
  sessionStatus = 'INITIALIZING';
  await initBrowser(); // Reintenta iniciar
}

// 📥 API: crear cuentas desde el frontend
app.post('/create-accounts', async (req, res) => {
  try {
    const count = req.body.count || 3;
    if (!browserInstance || sessionStatus !== 'ACTIVE') return res.status(503).json({ error: "Navegador no disponible" });

    const page = await browserInstance.newPage();
    const proxy = proxies[proxyIndex];
    if (proxy) await page.setExtraHTTPHeaders({ 'Proxy-Server': `http://${proxy}` });
    proxyIndex = (proxyIndex + 1) % proxies.length;

    const accounts = await createMultipleAccounts(count, page);
    await page.close();

    res.json({ success: true, accounts });
    notifyTelegram(`✅ ${accounts.length} cuentas creadas exitosamente.`);
  } catch (err) {
    console.error("❌ Error creando cuentas:", err.message);
    notifyTelegram(`❌ Error al crear cuentas: ${err.message}`);
    res.status(500).json({ error: 'Error creando cuentas', details: err.message });
  }
});

// 🔍 API: scraping de Instagram
app.get('/api/scrape', async (req, res) => {
  const username = req.query.username;
  if (!username) return res.status(400).json({ error: "Falta ?username=" });
  if (!browserInstance || sessionStatus !== 'ACTIVE') return res.status(503).json({ error: "Sesión no disponible", status: sessionStatus });

  try {
    const cookies = getCookies();
    const page = await browserInstance.newPage();
    const proxy = proxies[proxyIndex];
    if (proxy) await page.setExtraHTTPHeaders({ 'Proxy-Server': `http://${proxy}` });
    proxyIndex = (proxyIndex + 1) % proxies.length;
    await page.setCookie(...cookies);
    await page.goto(`https://www.instagram.com/${username}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const profile = await page.evaluate(() => {
      const avatar = document.querySelector('header img');
      const usernameElem = document.querySelector('header section h2');
      const verified = !!document.querySelector('svg[aria-label="Verified"]');
      const fullName = document.querySelector('header section h1')?.textContent;
      const meta = document.querySelector('meta[name="description"]')?.content;
      const match = meta?.match(/([\d,.KM]+)\s+Followers/);
      return {
        username: usernameElem?.textContent || 'N/A',
        fullName: fullName || 'N/A',
        verified,
        followers: match ? match[1] : 'N/A',
        profilePic: avatar?.src || 'N/A'
      };
    });

    await page.close();
    res.json({ profile });
  } catch (err) {
    console.error("❌ Scraping fallido:", err.message);
    res.status(500).json({ error: "Scraping fallido", reason: err.message });
  }
});

// 🧠 API: chatbot IA (OpenAI)
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

// 🔊 API: voz con OpenAI TTS
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

// 🔗 API: prueba de Bitly
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

// 🟢 Healthcheck
app.get('/health', (req, res) => {
  res.json({
    status: sessionStatus,
    browser: browserInstance ? 'ACTIVE' : 'INACTIVE',
    memory: process.memoryUsage().rss,
    uptime: process.uptime(),
    proxyCount: proxies.length
  });
});

// 🚀 Inicia el servidor
loadProxies().then(() => {
  initBrowser().then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Backend activo en puerto ${PORT}`);
      notifyTelegram(`🚀 Servidor backend activo en puerto ${PORT}`);
    });
  }).catch(err => {
    console.error('❌ Falla crítica - Servidor no iniciado:', err.message);
    notifyTelegram(`❌ Falla crítica al iniciar el backend: ${err.message}`);
    process.exit(1);
  });
}).catch(err => {
  console.error('❌ Error cargando proxies:', err.message);
  notifyTelegram(`❌ Error al cargar proxies: ${err.message}`);
});