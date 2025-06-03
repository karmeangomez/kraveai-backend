const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');
puppeteer.use(StealthPlugin());

const proxyList = [];
let proxyIndex = 0;

async function updateProxies() {
  try {
    const response = await axios.get('https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=10000&country=all');
    proxyList.length = 0; // Limpia la lista antes de agregar nuevos proxies
    proxyList.push(...response.data.split('\n').filter(p => p));
    console.log(`📡 Cargados ${proxyList.length} proxies`);
  } catch (error) {
    console.error("⚠️ Error cargando proxies:", error.message);
  }
}

function getNextProxy() {
  if (proxyIndex % 5 === 0) updateProxies().catch(() => {});
  const proxy = proxyList[proxyIndex] || '';
  proxyIndex = (proxyIndex + 1) % proxyList.length || 0;
  return proxy;
}

async function initBrowser() {
  try {
    console.log("🚀 Iniciando Puppeteer con Stealth...");
    const proxy = getNextProxy();
    const browserInstance = await puppeteer.launch({
      headless: "new",
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--enable-javascript',
        '--disable-blink-features=AutomationControlled',
        proxy ? `--proxy-server=http://${proxy}` : ''
      ],
      ignoreHTTPSErrors: true
    });

    const page = await browserInstance.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.4472.114 Safari/537.36');

    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      window.navigator.chrome = { runtime: {} };
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    });

    console.log(`📱 User-Agent: ${await page.evaluate(() => navigator.userAgent)}`);

    return { browserInstance, page };
  } catch (err) {
    console.error("❌ Error al iniciar Puppeteer:", err.message);
    return null;
  }
}

async function scrapeInstagram(username) {
  const { browserInstance, page } = await initBrowser();
  if (!browserInstance) return null;

  try {
    console.log(`🔍 Accediendo al perfil de Instagram: ${username}`);
    await page.goto(`https://www.instagram.com/${username}/`, { timeout: 60000, waitUntil: 'domcontentloaded' });

    await page.waitForFunction(() => document.querySelector('img[alt*="profile picture"]'), { timeout: 30000 });

    await page.evaluate(() => window.scrollBy(0, 300));

    const data = await page.evaluate(() => {
      return {
        username: document.querySelector('h1')?.textContent || "",
        profile_pic_url: document.querySelector('img[alt*="profile picture"]')?.src || "",
        followers_count: document.querySelector('header section ul li:nth-child(2) span')?.textContent || "",
        is_verified: !!document.querySelector('header section svg[aria-label="Verified"]')
      };
    });

    console.log("✅ Datos obtenidos:", data);
    await browserInstance.close();
    return data;
  } catch (error) {
    console.error("❌ Error al extraer datos:", error.message);
    await browserInstance.close();
    return null;
  }
}

module.exports = { scrapeInstagram };
