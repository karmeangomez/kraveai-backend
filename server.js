// ✅ server.js completo: Instagram + IA + Telegram + Frontend con proxies
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const { createMultipleAccounts } = require('./instagramAccountCreator'); // Asegúrate de que exista
const puppeteer = require('puppeteer-core'); // Cambiado a puppeteer-core
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { instagramLogin } = require('./instagramLogin'); // Asegúrate de que exista
const fs = require('fs').promises;
const UserAgent = require('user-agents');
const { Telegraf } = require('telegraf');
const chromium = require('@sparticuz/chromium-min'); // Añadido

puppeteer.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 3000;
let browserInstance = null;
let sessionStatus = 'INITIALIZING';
let proxyIndex = 0;
let proxies = [];
let invalidProxies = new Set(); // Para marcar proxies no funcionales

const telegramBot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Middleware para Express
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, '.')));

// Función para enviar logs a Railway y Telegram
async function logAndNotify(message, level = 'info', error = null) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}${error ? `: ${error.message}` : ''}`;
  
  // Enviar a stdout/stderr para Railway
  if (level === 'error') {
    console.error(logMessage);
  } else {
    console.log(logMessage);
  }
  
  // Enviar a Telegram
  try {
    await telegramBot.telegram.sendMessage(process.env.TELEGRAM_CHAT_ID, logMessage);
  } catch (err) {
    console.error(`[${timestamp}] [ERROR] Error enviando a Telegram: ${err.message}`);
  }
}

// 🔐 Carga proxies desde proxies.json
async function loadProxies() {
  try {
    const data = await fs.readFile(path.join(__dirname, 'proxies.json'), 'utf8');
    proxies = JSON.parse(data);
    await logAndNotify(`Cargados ${proxies.length} proxies desde proxies.json`);
  } catch (err) {
    await logAndNotify('No se pudo cargar proxies.json, iniciando extracción', 'warn', err);
    await scrapeProxies(); // Extrae proxies si no existe
  }
  if (proxies.length === 0) {
    await logAndNotify('Lista de proxies vacía, intentando extracción adicional...', 'warn');
    await scrapeProxies();
  }
}

// 🔎 Verifica si un proxy es funcional
async function checkProxy(proxy) {
  try {
    const response = await axios.head('https://www.google.com', {
      proxy: {
        host: proxy.split(':')[0],
        port: parseInt(proxy.split(':')[1]),
      },
      timeout: 10000,
      headers: {
        'User-Agent': new UserAgent().toString(),
      },
    });
    await logAndNotify(`Proxy ${proxy} es funcional`);
    return response.status === 200;
  } catch (error) {
    await logAndNotify(`Proxy ${proxy} no es funcional`, 'warn', error);
    return false;
  }
}

// 🔍 Extrae proxies (con todas las fuentes)
async function scrapeProxies() {
  await logAndNotify('Iniciando extracción de proxies...');
  const browser = await puppeteer.launch({
    executablePath: await chromium.executablePath(),
    args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
    headless: chromium.headless,
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
    {
      name: 'SSLProxies',
      url: 'https://www.sslproxies.org/',
      type: 'html',
      parse: async (page) => {
        await page.goto('https://www.sslproxies.org/', { waitUntil: 'load', timeout: 30000 });
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
      name: 'ProxyDB',
      url: 'http://proxydb.net/?protocol=https&anonlvl=4&sort=speed',
      type: 'html',
      parse: async (page) => {
        await page.goto('http://proxydb.net/?protocol=https&anonlvl=4&sort=speed', { waitUntil: 'load', timeout: 30000 });
        return await page.evaluate(() => {
          const rows = document.querySelectorAll('table tbody tr');
          return Array.from(rows).map(row => {
            const ipPort = row.cells[0].textContent.trim();
            return ipPort.match(/^\d+\.\d+\.\d+\.\d+:\d+$/) ? ipPort : '';
          }).filter(line => line);
        });
      },
    },
  ];

  try {
    const results = await Promise.allSettled(
      proxySources.map(async (source) => {
        try {
          await logAndNotify(`Extrayendo de ${source.name}...`);
          let proxies;
          if (source.type === 'api') {
            const response = await axios.get(source.url, { timeout: 30000 });
            proxies = source.parse(response.data);
          } else {
            proxies = await source.parse(page);
          }
          await logAndNotify(`${source.name}: ${proxies.length} proxies encontrados`);
          return proxies;
        } catch (error) {
          await logAndNotify(`Error en ${source.name}`, 'error', error);
          return [];
        }
      })
    );

    const allProxies = results
      .filter(result => result.status === 'fulfilled')
      .flatMap(result => result.value)
      .filter(proxy => proxy.match(/^\d+\.\d+\.\d+\.\d+:\d+$/));

    // Verificar cada proxy y guardar solo los funcionales
    const validProxies = [];
    for (const proxy of allProxies) {
      if (await checkProxy(proxy)) {
        validProxies.push(proxy);
      }
    }

    proxies = validProxies;
    await logAndNotify(`Total proxies válidos encontrados: ${proxies.length}`);
    await fs.writeFile(path.join(__dirname, 'proxies.json'), JSON.stringify(proxies, null, 2));
  } finally {
    await browser.close();
  }
}

// 🔐 Inicia navegador y login Instagram con proxies
async function initBrowser() {
  await loadProxies(); // Carga proxies al iniciar
  try {
    await logAndNotify("Verificando sesión de Instagram...");

    // Encuentra un proxy funcional
    let proxy = null;
    for (let i = 0; i < proxies.length; i++) {
      const candidate = proxies[proxyIndex];
      proxyIndex = (proxyIndex + 1) % proxies.length;
      if (!invalidProxies.has(candidate) && await checkProxy(candidate)) {
        proxy = candidate;
        break;
      } else {
        invalidProxies.add(candidate); // Marca como inválido si falla
      }
    }

    if (!proxy) {
      throw new Error('No se encontró un proxy funcional');
    }

    browserInstance = await puppeteer.launch({
      executablePath: await chromium.executablePath(),
      args: [
        ...chromium.args,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        '--single-process',
        '--js-flags=--max-old-space-size=256',
        `--proxy-server=http://${proxy}`
      ],
      headless: chromium.headless,
      ignoreHTTPSErrors: true
    });

    const page = await browserInstance.newPage();
    const isLoggedIn = await instagramLogin(page, process.env.INSTAGRAM_USERNAME, process.env.INSTAGRAM_PASSWORD);
    if (!isLoggedIn) {
      throw new Error('No se pudo iniciar sesión en Instagram');
    }
    await page.close();

    await logAndNotify(`Sesión de Instagram lista con proxy: ${proxy}`);
    sessionStatus = 'ACTIVE';
    setInterval(checkSessionValidity, 60 * 60 * 1000); // Verifica cada hora
  } catch (err) {
    sessionStatus = 'ERROR';
    await logAndNotify('Error al iniciar Chromium', 'error', err);
    await restartBrowser(); // Intenta reiniciar si falla
  }
}

// 🔁 Verifica sesión cada hora
async function checkSessionValidity() {
  if (!browserInstance) {
    sessionStatus = 'INACTIVE';
    await logAndNotify('Navegador no disponible, reiniciando...');
    await restartBrowser();
    return;
  }

  try {
    const page = await browserInstance.newPage();
    await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 15000 });

    const isLoggedIn = await page.evaluate(() => {
      return document.querySelector('a[href*="/accounts/activity/"]') !== null;
    });

    await page.close();
    if (!isLoggedIn) {
      await logAndNotify('Sesión expirada, reintentando login...', 'warn');
      const loginPage = await browserInstance.newPage();
      await instagramLogin(loginPage, process.env.INSTAGRAM_USERNAME, process.env.INSTAGRAM_PASSWORD);
      await loginPage.close();
      await logAndNotify('Sesión renovada exitosamente');
    }
    sessionStatus = 'ACTIVE';
  } catch (err) {
    sessionStatus = 'EXPIRED';
    await logAndNotify('Error verificando sesión', 'error', err);
    await restartBrowser(); // Reinicia si la sesión falla
  }
}

// 🔄 Reinicia el navegador en caso de fallo
async function restartBrowser() {
  if (browserInstance) {
    await logAndNotify('Cerrando navegador existente...');
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
    if (!browserInstance || sessionStatus !== 'ACTIVE') {
      return res.status(503).json({ error: "Navegador no disponible" });
    }

    const page = await browserInstance.newPage();
    const accounts = await createMultipleAccounts(count, page);
    await page.close();

    await logAndNotify(`${accounts.length} cuentas creadas exitosamente`);
    res.json({ success: true, accounts });
  } catch (err) {
    await logAndNotify('Error creando cuentas', 'error', err);
    res.status(500).json({ error: 'Error creando cuentas', details: err.message });
  }
});

// 🔍 API: scraping de Instagram
app.get('/api/scrape', async (req, res) => {
  const username = req.query.username;
  if (!username) {
    return res.status(400).json({ error: "Falta ?username=" });
  }
  if (!browserInstance || sessionStatus !== 'ACTIVE') {
    return res.status(503).json({ error: "Sesión no disponible", status: sessionStatus });
  }

  try {
    const page = await browserInstance.newPage();
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
    await logAndNotify(`Scraping exitoso para ${username}`);
    res.json({ profile });
  } catch (err) {
    await logAndNotify('Scraping fallido', 'error', err);
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
    await logAndNotify('Consulta de chat IA exitosa');
    res.json({ message: resp.data.choices[0].message.content });
  } catch (err) {
    await logAndNotify('Error en consulta de chat IA', 'error', err);
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
    await logAndNotify('Generación de voz exitosa');
    res.set('Content-Type', 'audio/mpeg');
    res.send(response.data);
  } catch (err) {
    await logAndNotify('Error generando voz', 'error', err);
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
    await logAndNotify('Acortamiento de URL con Bitly exitoso');
    res.json({ shortUrl: response.data.link });
  } catch (err) {
    await logAndNotify('Error en Bitly', 'error', err);
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
    app.listen(PORT, async () => {
      await logAndNotify(`Backend activo en puerto ${PORT}`);
    });
  }).catch(async err => {
    await logAndNotify('Falla crítica - Servidor no iniciado', 'error', err);
    process.exit(1);
  });
}).catch(async err => {
  await logAndNotify('Error cargando proxies', 'error', err);
});