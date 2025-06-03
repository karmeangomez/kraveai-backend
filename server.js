const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { scrapeInstagram, encryptPassword } = require('./instagramLogin');
const axios = require('axios');

puppeteer.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 3000;

let browserInstance = null;
const pagePool = new Set();

app.use(express.json());

const proxies = [
  '198.23.239.134:6540:pdsmombq:terqdq67j6mp',
  '207.244.217.165:6712:pdsmombq:terqdq67j6mp',
  '107.172.163.27:6543:pdsmombq:terqdq67j6mp',
  '161.123.152.115:6360:pdsmombq:terqdq67j6mp',
  '23.94.138.75:6349:pdsmombq:terqdq67j6mp',
  '216.10.27.159:6837:pdsmombq:terqdq67j6mp',
  '136.0.207.84:6661:pdsmombq:terqdq67j6mp',
  '64.64.118.149:6732:pdsmombq:terqdq67j6mp',
  '142.147.128.93:6593:pdsmombq:terqdq67j6mp',
  '154.36.110.199:6853:pdsmombq:terqdq67j6mp',
];
let proxyIndex = 0;

const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/118.0',
];

// 🛜 Validar y obtener próximo proxy
async function validateProxy(proxy) {
  try {
    const [host, port, username, password] = proxy.split(':');
    const response = await axios.get('https://www.google.com', {
      proxy: { host, port: parseInt(port), auth: { username, password } },
      timeout: 5000,
    });
    return response.status === 200;
  } catch {
    return false;
  }
}

async function getNextProxy() {
  for (let i = 0; i < proxies.length; i++) {
    const proxy = proxies[proxyIndex];
    proxyIndex = (proxyIndex + 1) % proxies.length;
    if (await validateProxy(proxy)) {
      console.log(`🛜 Proxy válido: ${proxy}`);
      return proxy;
    }
    console.warn(`⚠️ Proxy inválido: ${proxy}`);
  }
  console.warn('⚠️ No hay proxies válidos disponibles');
  return '';
}

// 🎲 Obtener User-Agent aleatorio
function getNextUserAgent() {
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

// 🛠️ Inicializar navegador
async function initBrowser() {
  try {
    console.log('🚀 Iniciando Puppeteer con Stealth...');

    const proxy = await getNextProxy();
    if (!proxy) throw new Error('No hay proxies válidos');

    const [host, port, username, password] = proxy.split(':');
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        '--enable-javascript',
        '--window-size=1920,1080',
        `--proxy-server=http://${host}:${port}`,
      ],
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();
    const ua = getNextUserAgent();
    await page.setUserAgent(ua);
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    });
    await page.setViewport({ width: 1920, height: 1080 });

    // Evitar detección de bot
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      window.navigator.chrome = { runtime: {} };
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3,

System: * Today's date and time is 05:45 PM CST on Tuesday, June 03, 2025.
