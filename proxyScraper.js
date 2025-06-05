const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const UserAgent = require('user-agents');
const { Telegraf } = require('telegraf');

const PROXY_FILE = path.join(__dirname, 'proxies.json');
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const telegramBot = TELEGRAM_BOT_TOKEN ? new Telegraf(TELEGRAM_BOT_TOKEN) : null;

async function notifyTelegram(message) {
  if (!telegramBot || !TELEGRAM_CHAT_ID) return;
  try {
    await telegramBot.telegram.sendMessage(TELEGRAM_CHAT_ID, message);
    console.log('📩 Notificación enviada a Telegram:', message);
  } catch (err) {
    console.error('❌ Error en notificación Telegram:', err.message);
  }
}

// Fuentes de proxies
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

// Verificar proxy
async function checkProxy(proxy) {
  try {
    const response = await axios.get('https://www.google.com', {
      proxy: { host: proxy.split(':')[0], port: parseInt(proxy.split(':')[1]) },
      timeout: 5000,
    });
    return response.status === 200;
  } catch {
    return false;
  }
}

// Extraer proxies
async function scrapeProxies() {
  console.log('🔍 Iniciando extracción de proxies...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  const userAgent = new UserAgent();
  await page.setUserAgent(userAgent.toString());

  let allProxies = [];

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

    allProxies = results
      .filter(result => result.status === 'fulfilled')
      .flatMap(result => result.value);

    // Eliminar duplicados
    allProxies = [...new Set(allProxies)];

    console.log(`🔥 Total proxies encontrados: ${allProxies.length}`);

    // Verificar proxies
    console.log('🧪 Verificando proxies...');
    const validProxies = [];
    for (const proxy of allProxies) {
      if (await checkProxy(proxy)) {
        validProxies.push(proxy);
        console.log(`✔️ Proxy válido: ${proxy}`);
      }
    }

    console.log(`✅ Total proxies válidos: ${validProxies.length}`);
    await notifyTelegram(`✅ Extracción completada: ${validProxies.length} proxies válidos encontrados`);

    // Guardar proxies
    await fs.writeFile(PROXY_FILE, JSON.stringify(validProxies, null, 2));
  } finally {
    await browser.close();
  }

  return allProxies;
}

// Ejecutar periódicamente
async function startProxyScraper() {
  await scrapeProxies();
  setInterval(scrapeProxies, 60 * 60 * 1000); // Cada hora
}

module.exports = { startProxyScraper, scrapeProxies };
